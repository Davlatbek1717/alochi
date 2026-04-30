import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { AdaptiveService } from '../adaptive/adaptive.service';
import { ChurnService } from '../churn/churn.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { KpiService, KPI_REASONS } from '../kpi/kpi.service';

/**
 * Tunable thresholds for the filadmin monthly KPI cron (§8.3).
 * Centralised here so they can be adjusted without hunting through
 * the cron body.
 */
export const FILADMIN_MONTHLY_KPI_THRESHOLDS = {
  /** Green-critical / total active students ratio cutoffs. */
  GREEN_RATIO_BONUS_HIGH: 0.8,
  GREEN_RATIO_BONUS_MID: 0.6,
  GREEN_RATIO_PENALTY_LOW: 0.4,
  /** Bonus / penalty point amounts. */
  BONUS_HIGH: 100,
  BONUS_MID: 50,
  PENALTY_LOW: -25,
  /** Extra penalty applied when blocked-students ratio exceeds threshold. */
  BLOCKED_RATIO_PENALTY: 0.1,
  BLOCKED_PENALTY: -25,
  /** Per-mentor-checkin daily reward (proxy for §8.1 "ran a lesson"). */
  MENTOR_DAILY_BASE_POINTS: 5,
} as const;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
    private adaptive: AdaptiveService,
    private churn: ChurnService,
    private clickhouse: ClickHouseService,
    private http: HttpService,
    private config: ConfigService,
    private events: EventEmitter2,
    private templates: NotificationTemplatesService,
    private kpi: KpiService,
  ) {}

  @Cron('59 23 * * *', { name: 'payment_block' })
  async runPaymentBlock() {
    this.logger.log('Cron: payment block boshlanmoqda...');

    const settings = await this.prisma.paymentSetting.findMany();

    for (const setting of settings) {
      const today = new Date();
      if (today.getDate() !== setting.paymentEndDay) continue;

      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const paidStudents = await this.prisma.payment.findMany({
        where: { tenantId: setting.tenantId, month },
        select: { studentId: true },
      });
      const paidIds = paidStudents.map((p) => p.studentId);

      const result = await this.prisma.user.updateMany({
        where: {
          tenantId: setting.tenantId,
          role: 'student',
          status: 'active',
          id: { notIn: paidIds },
        },
        data: { status: 'blocked_payment' },
      });

      this.logger.log(
        `Tenant ${setting.tenantId}: ${result.count} o'quvchi bloklandi`,
      );
    }
  }

  @Cron('1 0 * * *', { name: 'payment_unblock' })
  async runPaymentUnblock() {
    this.logger.log('Cron: payment unblock boshlanmoqda...');

    const now = new Date();
    const duePayments = await this.prisma.payment.findMany({
      where: {
        unblockAt: { lte: now },
        student: { status: 'blocked_payment' },
      },
      select: { studentId: true },
    });

    const ids = duePayments.map((p) => p.studentId);
    if (ids.length === 0) return;

    const result = await this.prisma.user.updateMany({
      where: { id: { in: ids }, status: 'blocked_payment' },
      data: { status: 'active' },
    });

    this.logger.log(`${result.count} o'quvchi to'lov blokidan chiqarildi`);
  }

  @Cron('1 0 * * *', { name: 'delegation_complete' })
  async runDelegationComplete() {
    const now = new Date();

    // Fetch the rows we are about to complete so we can emit per-row events
    // *before* updating — otherwise the toUserId/fromUserId become stale.
    const expired = await this.prisma.delegation.findMany({
      where: { status: 'active', endsAt: { lte: now } },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        tenantId: true,
      },
    });

    const result = await this.prisma.delegation.updateMany({
      where: {
        status: 'active',
        endsAt: { lte: now },
      },
      data: { status: 'completed' },
    });

    for (const d of expired) {
      this.events?.emit('delegation.completed', {
        delegationId: d.id,
        fromUserId: d.fromUserId,
        toUserId: d.toUserId,
        tenantId: d.tenantId,
      });
    }

    if (result.count > 0) {
      this.logger.log(`${result.count} delegatsiya avtomatik yakunlandi`);
    }
  }

  @Cron('0 9 * * *', { name: 'payment_reminder' })
  async runPaymentReminder() {
    this.logger.log('Cron: payment reminder boshlanmoqda...');

    const settings = await this.prisma.paymentSetting.findMany();
    const today = new Date();

    for (const setting of settings) {
      if (today.getDate() !== setting.paymentEndDay - 2) continue;

      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const paidIds = (
        await this.prisma.payment.findMany({
          where: { tenantId: setting.tenantId, month },
          select: { studentId: true },
        })
      ).map((p) => p.studentId);

      const unpaidStudents = await this.prisma.user.findMany({
        where: {
          tenantId: setting.tenantId,
          role: 'student',
          status: 'active',
          id: { notIn: paidIds },
          telegramId: { not: null },
        },
        select: { name: true, telegramId: true },
      });

      const daysLeft = setting.paymentEndDay - today.getDate();
      for (const student of unpaidStudents) {
        await this.telegram.sendMessage(
          student.telegramId!,
          this.telegram.formatPaymentReminder(student.name, daysLeft),
        );
      }

      this.logger.log(
        `Tenant ${setting.tenantId}: ${unpaidStudents.length} ta eslatma yuborildi`,
      );
    }
  }

  @Cron('0 9 * * *', { name: 'delegation_reminder' })
  async runDelegationReminder() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const delegations = await this.prisma.delegation.findMany({
      where: {
        status: 'active',
        endsAt: { gte: todayEnd, lte: tomorrow },
      },
      include: {
        fromUser: { select: { id: true, name: true } },
        toUser: { select: { id: true, name: true } },
      },
    });

    for (const d of delegations) {
      await this.notifications
        .send(
          d.fromUser.id,
          'delegation',
          'Delegatsiya tugayapti',
          `${d.toUser.name} ga delegatsiyangiz ertaga tugaydi.`,
        )
        .catch(() => {});

      await this.notifications
        .send(
          d.toUser.id,
          'delegation',
          'Delegatsiya tugayapti',
          `${d.fromUser.name} dan delegatsiya ertaga tugaydi.`,
        )
        .catch(() => {});
    }

    if (delegations.length > 0) {
      this.logger.log(`${delegations.length} delegatsiya eslatmasi yuborildi`);
    }
  }

  @Cron('0 20 * * *', { name: 'daily_parent_report' })
  async runDailyParentReport() {
    this.logger.log('Cron: daily parent report boshlanmoqda...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const students = await this.prisma.user.findMany({
      where: {
        role: 'student',
        status: 'active',
        parentTelegramId: { not: null },
      },
      select: {
        id: true,
        name: true,
        parentTelegramId: true,
        studentXp: { select: { totalXp: true, currentStreak: true } },
        studentStatuses: {
          where: { date: { gte: today, lt: tomorrow } },
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            englishStatus: true,
            personalStatus: true,
            criticalStatus: true,
          },
        },
        studentProgress: {
          where: {
            completedAt: { gte: today, lt: tomorrow },
            academyCompleted: true,
          },
          select: { id: true },
        },
      },
    });

    let sent = 0;
    for (const student of students) {
      if (!student.parentTelegramId) continue;
      const status = student.studentStatuses[0];
      const message = this.telegram.formatDailyReport({
        studentName: student.name,
        date: today.toLocaleDateString('uz-UZ'),
        lessons: student.studentProgress.length,
        englishStatus: status?.englishStatus ?? 'nomalum',
        personalStatus: status?.personalStatus ?? 'nomalum',
        criticalStatus: status?.criticalStatus ?? 'nomalum',
        studyMinutes: student.studentProgress.length * 15,
        streak: student.studentXp?.currentStreak ?? 0,
        totalXp: student.studentXp?.totalXp ?? 0,
      });
      await this.telegram
        .sendMessage(student.parentTelegramId, message)
        .catch(() => {});
      sent++;
    }

    this.logger.log(`Daily parent report: ${sent} ta ota-onaga yuborildi`);
  }

  @Cron('0 8 * * *', { name: 'manager_morning_alert' })
  async runManagerMorningAlert() {
    this.logger.log('Cron: manager morning alert boshlanmoqda...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const managers = await this.prisma.user.findMany({
      where: { role: 'manager', status: 'active', telegramId: { not: null } },
      select: {
        id: true,
        name: true,
        telegramId: true,
        branchId: true,
        tenantId: true,
      },
    });

    for (const manager of managers) {
      if (!manager.telegramId) continue;

      const [redCount, yellowCount] = await Promise.all([
        this.prisma.studentStatus.count({
          where: {
            date: { gte: today, lt: tomorrow },
            student: {
              tenantId: manager.tenantId,
              branchId: manager.branchId ?? undefined,
            },
            OR: [
              { englishStatus: 'qizil' },
              { personalStatus: 'qizil' },
              { criticalStatus: 'qizil' },
            ],
          },
        }),
        this.prisma.studentStatus.count({
          where: {
            date: { gte: today, lt: tomorrow },
            student: {
              tenantId: manager.tenantId,
              branchId: manager.branchId ?? undefined,
            },
            OR: [
              { englishStatus: 'sariq' },
              { personalStatus: 'sariq' },
              { criticalStatus: 'sariq' },
            ],
          },
        }),
      ]);

      if (redCount === 0 && yellowCount === 0) continue;

      const msg =
        `🔔 Ertalabki hisobot:\n` +
        `🔴 Qizil o'quvchilar: ${redCount}\n` +
        `🟡 Sariq o'quvchilar: ${yellowCount}\n\n` +
        `Batafsil: /manager/students`;

      await this.telegram.sendMessage(manager.telegramId, msg).catch(() => {});
    }
  }

  @Cron('0 8 * * *', { name: 'filadmin_daily_report' })
  async runFiladminDailyReport() {
    this.logger.log('Cron: filadmin daily report boshlanmoqda...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filadmins = await this.prisma.user.findMany({
      where: { role: 'filadmin', status: 'active', telegramId: { not: null } },
      select: { id: true, telegramId: true, branchId: true, tenantId: true },
    });

    for (const fa of filadmins) {
      if (!fa.telegramId || !fa.branchId) continue;

      const [staffCount, presentCount, studentCount] = await Promise.all([
        this.prisma.user.count({
          where: {
            branchId: fa.branchId,
            role: { in: ['mentor', 'manager', 'tester'] },
            status: 'active',
          },
        }),
        this.prisma.attendanceStaff.count({
          where: {
            date: { gte: today, lt: tomorrow },
            user: { branchId: fa.branchId },
            loginTime: { not: null },
          },
        }),
        this.prisma.user.count({
          where: { branchId: fa.branchId, role: 'student', status: 'active' },
        }),
      ]);

      const msg =
        `📊 Bugungi filial hisoboti:\n\n` +
        `👥 Xodimlar: ${presentCount}/${staffCount} keldi\n` +
        `🎓 Jami o'quvchilar: ${studentCount}`;

      await this.telegram.sendMessage(fa.telegramId, msg).catch(() => {});
    }
  }

  @Cron('0 2 * * *', { name: 'refresh_mv' })
  async runRefreshMaterializedViews() {
    this.logger.log('Cron: materialized views yangilanmoqda...');
    try {
      await this.prisma.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY lesson_stats_mv',
      );
      await this.prisma.$executeRawUnsafe(
        'REFRESH MATERIALIZED VIEW CONCURRENTLY branch_stats_mv',
      );
      this.logger.log('Materialized views yangilandi');
    } catch (e) {
      this.logger.error(`Materialized view refresh failed: ${e.message}`);
    }
  }

  @Cron('0 3 * * *', { name: 'adaptive_difficulty' })
  async runAdaptiveDifficulty() {
    this.logger.log('Cron: adaptive difficulty boshlanmoqda...');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.adaptive
        .runNightlyAdaptation(tenant.id)
        .catch((e) =>
          this.logger.error(`Adaptive error tenant ${tenant.id}: ${e.message}`),
        );
    }
  }

  @Cron('0 5 * * *', { name: 'ml_churn_train' })
  async runMlChurnTraining() {
    this.logger.log('Cron: ML churn training boshlanmoqda...');
    const mlUrl = this.config.get<string>('ML_SERVICE_URL');
    if (!mlUrl) {
      this.logger.warn('ML_SERVICE_URL not set — skip training');
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.post(`${mlUrl}/train`, {}, { timeout: 60_000 }),
      );
      this.logger.log(`ML training success: ${JSON.stringify(response.data)}`);
    } catch (e) {
      this.logger.warn(`ML training failed: ${(e as Error).message}`);
    }
  }

  @Cron('0 6 * * *', { name: 'churn_scoring' })
  async runChurnScoring() {
    this.logger.log('Cron: churn scoring boshlanmoqda...');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.churn
        .runDailyScoring(tenant.id)
        .catch((e) =>
          this.logger.error(`Churn error tenant ${tenant.id}: ${e.message}`),
        );
    }
  }

  @Cron('0 3 * * *', { name: 'clickhouse_retry' })
  async runClickHouseRetry() {
    this.logger.log('Cron: ClickHouse retry boshlanmoqda...');
    if (!this.clickhouse.isReady()) {
      this.logger.warn('ClickHouse not ready, skip retry');
      return;
    }
    const BATCH = 1000;
    const unsynced = await this.prisma.analyticsEvent.findMany({
      where: { syncedAt: null },
      take: BATCH,
      orderBy: { createdAt: 'asc' },
    });
    let synced = 0;
    for (const event of unsynced) {
      const data = (event.data ?? {}) as Record<string, unknown>;
      const lessonId = (data as { lessonId?: string }).lessonId ?? null;
      const sessionCount =
        (data as { sessionCount?: number }).sessionCount ?? 0;
      const isPresent = (data as { isPresent?: boolean }).isPresent;
      const isLate = (data as { isLate?: boolean }).isLate;
      const newStreak = (data as { newStreak?: number }).newStreak;

      try {
        await this.clickhouse.insertEvent({
          event_id: event.id,
          tenant_id: event.tenantId,
          event_type: event.eventType,
          student_id: event.studentId,
          branch_id: event.branchId,
          lesson_id: lessonId,
          session_count: sessionCount,
          is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
          is_late: isLate === undefined ? null : isLate ? 1 : 0,
          new_streak: newStreak ?? null,
          data: JSON.stringify(data),
          created_at: event.createdAt.toISOString(),
        });
        await this.prisma.analyticsEvent.update({
          where: { id: event.id },
          data: { syncedAt: new Date() },
        });
        synced++;
      } catch (e) {
        this.logger.warn(
          `ClickHouse retry failed for event ${event.id}: ${(e as Error).message}`,
        );
      }
    }
    this.logger.log(
      `ClickHouse retry: ${synced}/${unsynced.length} events synced`,
    );
  }

  async triggerPaymentUnblockManually() {
    return this.runPaymentUnblock();
  }

  /**
   * Notify the parent of a student who has been absent for 2 consecutive
   * days (no `attendance_students` row in the last 2 days). Runs once daily
   * at 18:00 — late enough that today's attendance has been logged.
   */
  @Cron('0 18 * * *', { name: 'absent_2day_parent_reminder' })
  async runAbsent2DayParentReminder() {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setHours(0, 0, 0, 0);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const students = await this.prisma.user.findMany({
        where: {
          role: 'student',
          status: 'active',
          parentTelegramId: { not: null },
          studentAttendances: {
            none: {
              date: { gte: twoDaysAgo },
              status: { in: ['present', 'late'] },
            },
          },
        },
        select: { id: true, name: true, tenantId: true },
      });

      let sent = 0;
      for (const s of students) {
        const ok = await this.telegram.sendToParent(
          s.id,
          'attendance.absent_2day',
          { studentName: s.name },
          s.tenantId,
        );
        if (ok) sent++;
      }
      if (sent > 0) {
        this.logger.log(
          `absent_2day_parent_reminder: ${sent}/${students.length} ota-ona xabardor qilindi`,
        );
      }
    } catch (err) {
      this.logger.error(
        `absent_2day_parent_reminder failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * §8.1 — Mentor KPI auto-calc.
   *
   * Runs daily at 22:00 (after the school day is done). For every active
   * mentor with a confirmed check-in today (`AttendanceStaff.loginTime
   * IS NOT NULL`) we award a flat block of points — the closest proxy
   * we have for "ran qualifying lesson(s) today". The schema has no
   * Lesson-session model with mentorId/duration/studentCount, so a
   * full per-lesson breakdown is not yet possible without a schema
   * change; this implementation captures the "vaqtida xabar berdi /
   * darsda qatnashdi" portion of the spec.
   *
   * Idempotent per mentor per day via `kpi.hasAwardInRange`.
   */
  @Cron('0 22 * * *', { name: 'mentor_kpi_calc' })
  async runMentorKpiCalc() {
    this.logger.log('Cron: mentor_kpi_calc.start');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    try {
      const mentors = await this.prisma.user.findMany({
        where: { role: 'mentor', status: 'active' },
        select: { id: true, tenantId: true, branchId: true },
      });

      let awarded = 0;
      let skipped = 0;

      for (const mentor of mentors) {
        // Skip if already awarded for this reason today (idempotency).
        const already = await this.kpi.hasAwardInRange(
          mentor.id,
          KPI_REASONS.AUTO_MENTOR_DAILY,
          today,
          tomorrow,
        );
        if (already) {
          skipped++;
          continue;
        }

        // Did the mentor actually check in today? loginTime IS NOT NULL
        // is our proxy for "showed up and ran the day".
        const checkin = await this.prisma.attendanceStaff.findFirst({
          where: {
            userId: mentor.id,
            date: { gte: today, lt: tomorrow },
            loginTime: { not: null },
          },
          select: { id: true },
        });
        if (!checkin) continue;

        await this.kpi.award({
          tenantId: mentor.tenantId,
          userId: mentor.id,
          score: FILADMIN_MONTHLY_KPI_THRESHOLDS.MENTOR_DAILY_BASE_POINTS,
          reason: KPI_REASONS.AUTO_MENTOR_DAILY,
        });
        awarded++;
      }

      this.logger.log(
        `mentor_kpi_calc.done awarded=${awarded} skipped=${skipped} total=${mentors.length}`,
      );
    } catch (err) {
      this.logger.error(`mentor_kpi_calc.failed: ${(err as Error).message}`);
    }
  }

  /**
   * §8.3 — Filadmin oylik bonus / jarima.
   *
   * Cron expression `0 23 28-31 * *` fires at 23:00 on the 28th, 29th,
   * 30th, and 31st of every month. We early-return on every fire that
   * is *not* actually the last day of the month (i.e. tomorrow is still
   * the same month) so the body runs exactly once per calendar month.
   *
   * For each tenant→branch→filadmin we compute:
   *   - total active students in the branch
   *   - count of students whose latest critical status is `yashil`
   *   - count of `blocked_payment` students in the branch
   * and apply the threshold-based bonus / penalty defined in
   * `FILADMIN_MONTHLY_KPI_THRESHOLDS`.
   *
   * Idempotent per filadmin per month via `kpi.hasAwardInRange`
   * over the current calendar month.
   */
  @Cron('0 23 28-31 * *', { name: 'filadmin_monthly_kpi' })
  async runFiladminMonthlyKpi() {
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    if (today.getMonth() === tomorrow.getMonth()) {
      // Not actually the last day of the month — skip.
      return;
    }

    this.logger.log('Cron: filadmin_monthly_kpi.start');
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const T = FILADMIN_MONTHLY_KPI_THRESHOLDS;

    try {
      const filadmins = await this.prisma.user.findMany({
        where: {
          role: 'filadmin',
          status: 'active',
          branchId: { not: null },
        },
        select: { id: true, tenantId: true, branchId: true },
      });

      let bonusCount = 0;
      let penaltyCount = 0;
      let skippedCount = 0;

      for (const fa of filadmins) {
        if (!fa.branchId) continue;

        // Idempotency — skip if a bonus or penalty has already been
        // awarded for this filadmin somewhere in the current month.
        const [bonusAlready, penaltyAlready] = await Promise.all([
          this.kpi.hasAwardInRange(
            fa.id,
            KPI_REASONS.FILADMIN_MONTHLY_BONUS,
            startOfMonth,
            endOfMonth,
          ),
          this.kpi.hasAwardInRange(
            fa.id,
            KPI_REASONS.FILADMIN_MONTHLY_PENALTY,
            startOfMonth,
            endOfMonth,
          ),
        ]);
        if (bonusAlready || penaltyAlready) {
          skippedCount++;
          continue;
        }

        const [totalStudents, greenCritical, blocked] = await Promise.all([
          this.prisma.user.count({
            where: {
              branchId: fa.branchId,
              role: 'student',
              status: 'active',
            },
          }),
          this.prisma.studentStatus.count({
            where: {
              criticalStatus: 'yashil',
              date: { gte: startOfMonth, lte: endOfMonth },
              student: {
                branchId: fa.branchId,
                role: 'student',
              },
            },
          }),
          this.prisma.user.count({
            where: {
              branchId: fa.branchId,
              role: 'student',
              status: 'blocked_payment',
            },
          }),
        ]);

        if (totalStudents === 0) continue;

        const ratio = greenCritical / totalStudents;
        let bonus = 0;
        if (ratio >= T.GREEN_RATIO_BONUS_HIGH) bonus = T.BONUS_HIGH;
        else if (ratio >= T.GREEN_RATIO_BONUS_MID) bonus = T.BONUS_MID;
        else if (ratio < T.GREEN_RATIO_PENALTY_LOW) bonus = T.PENALTY_LOW;

        if (blocked / totalStudents > T.BLOCKED_RATIO_PENALTY) {
          bonus += T.BLOCKED_PENALTY;
        }

        if (bonus === 0) continue;

        await this.kpi.award({
          tenantId: fa.tenantId,
          userId: fa.id,
          score: bonus,
          reason:
            bonus > 0
              ? KPI_REASONS.FILADMIN_MONTHLY_BONUS
              : KPI_REASONS.FILADMIN_MONTHLY_PENALTY,
        });

        if (bonus > 0) bonusCount++;
        else penaltyCount++;
      }

      this.logger.log(
        `filadmin_monthly_kpi.done bonus=${bonusCount} penalty=${penaltyCount} skipped=${skippedCount}`,
      );
    } catch (err) {
      this.logger.error(
        `filadmin_monthly_kpi.failed: ${(err as Error).message}`,
      );
    }
  }
}
