import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTemplatesService } from '../notification-templates/notification-templates.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { KpiService, KPI_REASONS } from '../kpi/kpi.service';
import { VideoCheckinService } from '../video-checkin/video-checkin.service';
import { VideoCheckinHandler } from '../telegram/handlers/video-checkin.handler';
import {
  tashkentDateString,
  dateStringToDate,
} from '../video-checkin/lib/tashkent-time';

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
} as const;

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
    private clickhouse: ClickHouseService,
    private config: ConfigService,
    private events: EventEmitter2,
    private templates: NotificationTemplatesService,
    private kpi: KpiService,
    private videoCheckin: VideoCheckinService,
    private videoCheckinHandler: VideoCheckinHandler,
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
    if (ids.length > 0) {
      const result = await this.prisma.user.updateMany({
        where: { id: { in: ids }, status: 'blocked_payment' },
        data: { status: 'active' },
      });
      this.logger.log(`${result.count} o'quvchi to'lov blokidan chiqarildi`);
    }

    // §15.3 — unblock_at monitoring. Any student whose payment.unblockAt
    // has passed but who is still status='blocked_payment' is a stuck row
    // (race / partial failure). Alert superadmins via Telegram.
    try {
      const stuck = await this.prisma.payment.findMany({
        where: {
          unblockAt: { lt: now },
          student: { status: 'blocked_payment' },
        },
        select: {
          studentId: true,
          student: { select: { name: true, tenantId: true } },
        },
      });

      if (stuck.length > 0) {
        const ids = stuck.map((p) => p.studentId);
        const names = stuck.map((p) => p.student?.name).filter(Boolean);
        this.logger.warn(
          `unblock_failed count=${stuck.length} userIds=${ids.join(',')}`,
        );

        const superadmins = await this.prisma.user.findMany({
          where: {
            role: 'superadmin',
            status: 'active',
            telegramId: { not: null },
          },
          select: { telegramId: true, tenantId: true },
        });
        for (const sa of superadmins) {
          if (!sa.telegramId) continue;
          await this.telegram
            .sendTemplate(
              sa.telegramId,
              'unblock.failed_monitoring',
              {
                count: String(stuck.length),
                userIds: names.slice(0, 10).join(', '),
              },
              sa.tenantId,
            )
            .catch(() => undefined);
        }
      }
    } catch (err) {
      this.logger.error(
        `unblock_failed monitoring error: ${(err as Error).message}`,
      );
    }
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

    // Real tracked study time is keyed by the Tashkent calendar date
    // (the same key the /study-time/ping heartbeat writes), not the
    // server-local midnight used for lesson/status windows above.
    const studyDateObj = dateStringToDate(tashkentDateString());

    const students = await this.prisma.user.findMany({
      where: {
        role: 'student',
        status: 'active',
        // Deliver the report to whichever Telegram chats are linked for
        // this student — the parent's chat AND/OR the student's own chat
        // (the one used for daily video check-in). One bot, both flows.
        OR: [
          { parentTelegramId: { not: null } },
          { telegramId: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        parentTelegramId: true,
        telegramId: true,
        studentStreak: { select: { currentStreak: true } },
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
        studyTimeDaily: {
          where: { date: studyDateObj },
          select: { seconds: true },
          take: 1,
        },
      },
    });

    let sent = 0;
    for (const student of students) {
      // Merge recipients: the parent's linked chat + the student's own
      // video-check-in chat. Deduped so a family using one chat for both
      // never gets the report twice.
      const recipients = new Set<string>();
      if (student.parentTelegramId) {
        recipients.add(student.parentTelegramId);
      }
      if (student.telegramId) {
        recipients.add(String(student.telegramId));
      }
      if (recipients.size === 0) continue;

      const status = student.studentStatuses[0];
      const message = this.telegram.formatDailyReport({
        studentName: student.name,
        date: today.toLocaleDateString('uz-UZ'),
        lessons: student.studentProgress.length,
        englishStatus: status?.englishStatus ?? 'nomalum',
        personalStatus: status?.personalStatus ?? 'nomalum',
        criticalStatus: status?.criticalStatus ?? 'nomalum',
        studyMinutes: Math.floor(
          (student.studyTimeDaily[0]?.seconds ?? 0) / 60,
        ),
        streak: student.studentStreak?.currentStreak ?? 0,
      });
      for (const chatId of recipients) {
        await this.telegram.sendMessage(chatId, message).catch(() => {});
        sent++;
      }
    }

    this.logger.log(`Daily report: ${sent} ta xabar yuborildi`);
  }

  /**
   * Mirror the just-finished Tashkent day's per-student study-time totals
   * into the analytics outbox (analytics_events). The existing outbox
   * flusher pushes these to ClickHouse — no direct CH write here, so we
   * stay reliable even when ClickHouse is down (events sync on recovery).
   * Runs at 01:15 server time: Tashkent is UTC+5, so "now − 24h" reliably
   * resolves to the day that has fully closed in Tashkent.
   */
  @Cron('15 1 * * *', { name: 'study_time_mirror' })
  async runStudyTimeMirror() {
    this.logger.log('Cron: study-time ClickHouse mirror boshlanmoqda...');
    const dateStr = tashkentDateString(
      new Date(Date.now() - 24 * 3600 * 1000),
    );
    const dateObj = dateStringToDate(dateStr);

    const rows = await this.prisma.studyTimeDaily.findMany({
      where: { date: dateObj },
      select: {
        studentId: true,
        tenantId: true,
        branchId: true,
        seconds: true,
      },
    });
    if (rows.length === 0) {
      this.logger.log(`Study-time mirror: maʼlumot yoʻq (${dateStr})`);
      return;
    }

    const branchIds = [
      ...new Set(
        rows.map((r) => r.branchId).filter((b): b is string => !!b),
      ),
    ];
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, minDailyStudyMinutes: true },
        })
      : [];
    const thByBranch = new Map(
      branches.map((b) => [b.id, b.minDailyStudyMinutes]),
    );

    let n = 0;
    for (const r of rows) {
      const minutes = Math.floor(r.seconds / 60);
      const thresholdMinutes = r.branchId
        ? (thByBranch.get(r.branchId) ?? 0)
        : 0;
      const below = thresholdMinutes > 0 && minutes < thresholdMinutes;
      await this.prisma.analyticsEvent
        .create({
          data: {
            tenantId: r.tenantId,
            eventType: 'study_time_daily',
            studentId: r.studentId,
            branchId: r.branchId,
            data: { date: dateStr, minutes, thresholdMinutes, below },
          },
        })
        .then(() => {
          n++;
        })
        .catch((e) =>
          this.logger.warn(
            `study-time mirror row failed: ${(e as Error).message}`,
          ),
        );
    }
    this.logger.log(
      `Study-time mirror: ${n} ta event yozildi (${dateStr})`,
    );
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
   * Trial expiry check — 2am daily.
   *
   * Finds all tenants where `trialEndsAt` has passed AND the tenant does not
   * yet have an active subscription (no row in tenant_subscriptions with
   * status='active'). Sets `isActive = false` on those tenants so they are
   * effectively locked out until they subscribe.
   */
  @Cron('0 2 * * *', { name: 'trial_expiry_check' })
  async checkTrialExpiries() {
    this.logger.log('Cron: trial_expiry_check.start');
    const now = new Date();

    try {
      // ── 3-day warning ─────────────────────────────────────────────────────
      const threeDaysFromNow = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      );
      const soonExpiring = await this.prisma.tenant.findMany({
        where: {
          trialEndsAt: { gt: now, lte: threeDaysFromNow },
          isActive: true,
          subscription: null,
        },
        select: {
          id: true,
          name: true,
          trialEndsAt: true,
          users: {
            where: {
              role: 'filadmin',
              status: 'active',
              telegramId: { not: null },
            },
            select: { telegramId: true },
            take: 1,
          },
        },
      });

      for (const tenant of soonExpiring) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        const daysLeft = Math.ceil(
          ((tenant.trialEndsAt?.getTime() ?? 0) - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `⚠️ <b>${tenant.name}</b>: sinov davri ${daysLeft} kunda tugaydi.\n\nObunani boshlash: <b>Filadmin paneli → Billing</b>`,
          );
        } catch {
          /* Telegram send failure must not block the loop */
        }
      }

      // ── 1-day urgent warning ───────────────────────────────────────────────
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const urgentExpiring = await this.prisma.tenant.findMany({
        where: {
          trialEndsAt: { gt: now, lte: oneDayFromNow },
          isActive: true,
          subscription: null,
        },
        select: {
          id: true,
          name: true,
          users: {
            where: {
              role: 'filadmin',
              status: 'active',
              telegramId: { not: null },
            },
            select: { telegramId: true },
            take: 1,
          },
        },
      });

      for (const tenant of urgentExpiring) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `🚨 <b>${tenant.name}</b>: Ertaga sinov davri tugaydi va kirish bloklanadi!\n\nHoziroq obuna qiling: <b>Filadmin paneli → Billing</b>`,
          );
        } catch {
          /* ignore */
        }
      }

      // ── Hard block expired tenants ─────────────────────────────────────────
      const expiredTenants = await this.prisma.tenant.findMany({
        where: {
          isActive: true,
          trialEndsAt: { lt: now },
          OR: [
            { subscription: null },
            { subscription: { status: { not: 'active' } } },
          ],
        },
        select: {
          id: true,
          name: true,
          users: {
            where: {
              role: 'filadmin',
              status: 'active',
              telegramId: { not: null },
            },
            select: { telegramId: true },
            take: 1,
          },
        },
      });

      if (expiredTenants.length === 0) {
        this.logger.log('trial_expiry_check.done expired=0');
        return;
      }

      const ids = expiredTenants.map((t) => t.id);
      const result = await this.prisma.tenant.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      });

      // Notify blocked tenants
      for (const tenant of expiredTenants) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `🔒 <b>${tenant.name}</b>: Sinov davri tugadi va kirish bloklanadi.\n\nObuna qilish: <b>Filadmin paneli → Billing</b>`,
          );
        } catch {
          /* ignore */
        }
      }

      this.logger.log(
        `trial_expiry_check.done expired=${result.count} tenantIds=${ids.join(',')}`,
      );
    } catch (err) {
      this.logger.error(`trial_expiry_check.failed: ${(err as Error).message}`);
    }
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
   * Runs daily at 22:00 (after the school day is done). For every
   * active mentor who checked in today, derive the four §8.1 scoring
   * inputs from existing data and call `kpi.computeMentorDaily`:
   *
   *   studentsTaught   ← AttendanceStudent rows (present/late) for
   *                      students in the mentor's group, today.
   *   durationMinutes  ← 60 if loginTime exists else 0 (we have no
   *                      logout time in schema, so this approximates
   *                      "stayed for the lesson"). Threshold is 15.
   *   scoresGiven      ← StudentStatus rows dated today for students
   *                      in the mentor's group.
   *   redNotified      ← Warning rows where givenBy = mentor.id today.
   *
   * Was previously a flat MENTOR_DAILY_BASE_POINTS = 5 award per
   * check-in, ignoring all the spec inputs. Now scored 0-20 ball via
   * the real formula.
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
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          groupId: true,
        },
      });

      let awarded = 0;
      let skipped = 0;

      for (const mentor of mentors) {
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

        // Did the mentor actually show up?
        const checkin = await this.prisma.attendanceStaff.findFirst({
          where: {
            userId: mentor.id,
            date: { gte: today, lt: tomorrow },
            loginTime: { not: null },
          },
          select: { id: true, loginTime: true },
        });
        if (!checkin) continue;

        // Mentors without a group can't be measured (no group → no
        // students to teach). Skip rather than award arbitrary points.
        if (!mentor.groupId) {
          skipped++;
          continue;
        }

        const [studentsTaught, scoresGiven, redNotified] = await Promise.all([
          this.prisma.attendanceStudent.count({
            where: {
              date: { gte: today, lt: tomorrow },
              status: { in: ['present', 'late'] },
              student: { groupId: mentor.groupId },
            },
          }),
          this.prisma.studentStatus.count({
            where: {
              date: { gte: today, lt: tomorrow },
              student: { groupId: mentor.groupId },
            },
          }),
          this.prisma.warning.count({
            where: {
              givenBy: mentor.id,
              isCancelled: false,
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
        ]);

        const { totalScore } = this.kpi.computeMentorDaily({
          studentsTaught,
          // Schema has no logout time; checked-in mentors get the
          // full 60-min credit so the duration row scores +5.
          durationMinutes: 60,
          scoresGiven,
          redNotified,
        });

        if (totalScore <= 0) {
          skipped++;
          continue;
        }

        await this.kpi.award({
          tenantId: mentor.tenantId,
          userId: mentor.id,
          score: totalScore,
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

  /**
   * §15.4 — Spaced repetition morning notification.
   *
   * Every day at 07:00 we look at all `SpacedRepetitionItem` rows whose
   * `nextReview` falls before tomorrow (i.e. due today or earlier),
   * group them by student, and ping each student with a single in-app
   * notification (and Telegram message if linked).
   */
  @Cron('0 7 * * *', { name: 'spaced_repetition_morning' })
  async runSpacedRepetitionMorning() {
    this.logger.log({ event: 'spaced_repetition_morning.start' });
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today.getTime() + 86_400_000);

      const dueItems = await this.prisma.spacedRepetitionItem.findMany({
        where: { nextReview: { lt: tomorrow } },
        select: {
          studentId: true,
          word: true,
          student: {
            select: {
              id: true,
              name: true,
              tenantId: true,
              telegramId: true,
              status: true,
            },
          },
        },
      });

      // Group by studentId
      const byUser = new Map<
        string,
        {
          student: {
            id: string;
            name: string;
            tenantId: string;
            telegramId: bigint | null;
            status: string;
          };
          words: string[];
        }
      >();
      for (const item of dueItems) {
        if (!item.student || item.student.status !== 'active') continue;
        const entry = byUser.get(item.studentId);
        if (entry) {
          entry.words.push(item.word);
        } else {
          byUser.set(item.studentId, {
            student: item.student,
            words: [item.word],
          });
        }
      }

      for (const [userId, { student, words }] of byUser) {
        await this.notifications
          .send(
            userId,
            'spaced_repetition',
            `${words.length} ta dars takrorlash uchun`,
            `Bugun ${words.length} ta darsni takrorlashingiz tavsiya etiladi.`,
          )
          .catch(() => undefined);

        if (student.telegramId) {
          await this.telegram
            .sendTemplate(
              student.telegramId,
              'spaced_repetition.morning',
              {
                count: String(words.length),
                firstLessonTitle: words[0] ?? 'dars',
              },
              student.tenantId,
            )
            .catch(() => undefined);
        }
      }

      this.logger.log({
        event: 'spaced_repetition_morning.done',
        users: byUser.size,
      });
    } catch (err) {
      this.logger.error(
        `spaced_repetition_morning.failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Daily 09:00 — remind assignees about tasks whose deadline is tomorrow.
   * In-app notification + Telegram (if linked).
   */
  @Cron('0 9 * * *', { name: 'task_due_reminder' })
  async runTaskDueReminder() {
    this.logger.log({ event: 'task_due_reminder.start' });
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow.getTime() + 86_400_000);

      const tasks = await this.prisma.task.findMany({
        where: {
          deadline: { gte: tomorrow, lt: dayAfter },
          status: { in: ['sent', 'seen', 'in_progress'] },
        },
        include: {
          assignee: {
            select: { id: true, telegramId: true, tenantId: true },
          },
        },
      });

      for (const task of tasks) {
        await this.notifications
          .send(
            task.assignedTo,
            'task_due_tomorrow',
            'Vazifa muddati ertaga',
            `"${task.title}" muddati ertaga tugaydi.`,
          )
          .catch(() => undefined);

        if (task.assignee.telegramId) {
          await this.telegram
            .sendTemplate(
              task.assignee.telegramId,
              'task.due_tomorrow',
              { title: task.title },
              task.assignee.tenantId,
            )
            .catch(() => undefined);
        }
      }

      this.logger.log({
        event: 'task_due_reminder.done',
        tasks: tasks.length,
      });
    } catch (err) {
      this.logger.error(`task_due_reminder.failed: ${(err as Error).message}`);
    }
  }

  // ── Video check-in crons (Asia/Tashkent timezone) ──────────────────────────

  /**
   * 04:55 Tashkent — "Ertalabki video vaqti yetdi" reminder.
   * Fires 5 minutes before the morning window opens at 05:00.
   * Only sent to students who haven't submitted morning video yet
   * (always empty pre-window, but kept for consistency with evening).
   */
  @Cron('55 4 * * *', {
    name: 'video_morning_start_reminder',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoMorningStartReminder() {
    this.logger.log('Cron: video_morning_start_reminder');
    const bot = this.telegram.getBot();
    if (!bot) return;
    try {
      const recipients =
        await this.videoCheckin.getReminderRecipients('morning');
      const msg =
        'Ertalabki video tashlash vaqti yetdi (05:00–06:30). Iltimos, video yuboring!';
      await Promise.allSettled(
        recipients.map((r) =>
          this.videoCheckinHandler.sendReminder(bot, r.telegramId, msg),
        ),
      );
      this.logger.log(
        `video_morning_start_reminder: ${recipients.length} ta yuborildi`,
      );
    } catch (err) {
      this.logger.error(
        `video_morning_start_reminder failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 06:25 Tashkent — "5 daqiqa qoldi" morning last-call reminder.
   */
  @Cron('25 6 * * *', {
    name: 'video_morning_lastcall_reminder',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoMorningLastcallReminder() {
    this.logger.log('Cron: video_morning_lastcall_reminder');
    const bot = this.telegram.getBot();
    if (!bot) return;
    try {
      const recipients =
        await this.videoCheckin.getReminderRecipients('morning');
      const msg =
        'Ertalabki video vaqti tugayapti — 5 daqiqa qoldi! Tez video yuboring.';
      await Promise.allSettled(
        recipients.map((r) =>
          this.videoCheckinHandler.sendReminder(bot, r.telegramId, msg),
        ),
      );
      this.logger.log(
        `video_morning_lastcall_reminder: ${recipients.length} ta yuborildi`,
      );
    } catch (err) {
      this.logger.error(
        `video_morning_lastcall_reminder failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Filadmin morning-video status report (Telegram).
   *
   * Two runs per day to the linked Telegram of every active filadmin:
   *   - 06:35 Tashkent — right after the on-time window (05:00–06:30)
   *     closes: who has submitted vs. who hasn't yet.
   *   - 10:00 Tashkent — follow-up: who submitted (incl. late) vs. who
   *     still hasn't.
   *
   * One message per branch (reusing VideoCheckinService.getTodayList),
   * sent to each filadmin in that branch who linked their Telegram.
   */
  private async sendFiladminVideoReports(label: string, finalMode: boolean) {
    const filadmins = await this.prisma.user.findMany({
      where: {
        role: 'filadmin',
        status: 'active',
        telegramId: { not: null },
        branchId: { not: null },
      },
      select: { telegramId: true, branchId: true },
    });
    if (filadmins.length === 0) {
      this.logger.log(`filadmin video report (${label}): linked filadmin yo'q`);
      return;
    }

    // Group filadmins by branch so getTodayList runs once per branch.
    const byBranch = new Map<string, bigint[]>();
    for (const f of filadmins) {
      if (!f.branchId || f.telegramId === null) continue;
      const arr = byBranch.get(f.branchId) ?? [];
      arr.push(f.telegramId);
      byBranch.set(f.branchId, arr);
    }

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtTime = (iso: string | null) => {
      if (!iso) return '';
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tashkent',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(iso));
      } catch {
        return '';
      }
    };
    const dateStr = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tashkent',
    });
    const CAP = 60;

    let branchesSent = 0;
    for (const [branchId, chatIds] of byBranch) {
      try {
        const branch = await this.prisma.branch.findUnique({
          where: { id: branchId },
          select: { name: true },
        });
        const rows = await this.videoCheckin.getTodayList(branchId);
        if (rows.length === 0) continue;

        const done = rows.filter(
          (r) => r.morning === 'submitted' || r.morning === 'late',
        );
        const notDone = rows.filter(
          (r) => r.morning !== 'submitted' && r.morning !== 'late',
        );

        const lines: string[] = [];
        lines.push(`📹 <b>${esc(branch?.name ?? 'Filial')} — ${label}</b>`);
        lines.push(`📅 ${dateStr}`);
        lines.push(
          `✅ Tashladi: <b>${done.length}</b>  ·  ${
            finalMode ? '❌ Tashlamadi' : '⏳ Hali yo‘q'
          }: <b>${notDone.length}</b>  ·  Jami: ${rows.length}`,
        );

        if (done.length > 0) {
          lines.push('');
          lines.push('✅ <b>Video tashlaganlar</b>');
          done.slice(0, CAP).forEach((r) => {
            const t = fmtTime(r.morningAt);
            const lateTag = r.morning === 'late' ? ' <i>(kech)</i>' : '';
            lines.push(`• ${esc(r.name)}${t ? ` — ${t}` : ''}${lateTag}`);
          });
          if (done.length > CAP)
            lines.push(`…va yana ${done.length - CAP} ta`);
        }

        if (notDone.length > 0) {
          lines.push('');
          lines.push(
            finalMode
              ? '❌ <b>Video tashlamaganlar</b>'
              : '⏳ <b>Hali tashlamaganlar</b>',
          );
          notDone.slice(0, CAP).forEach((r) => {
            lines.push(`• ${esc(r.name)}`);
          });
          if (notDone.length > CAP)
            lines.push(`…va yana ${notDone.length - CAP} ta`);
        }

        const text = lines.join('\n');
        await Promise.allSettled(
          chatIds.map((chatId) => this.telegram.sendMessage(chatId, text)),
        );
        branchesSent++;
      } catch (err) {
        this.logger.warn(
          `filadmin video report branch ${branchId} failed: ${
            (err as Error).message
          }`,
        );
      }
    }
    this.logger.log(
      `filadmin video report (${label}): ${branchesSent} ta filial yuborildi`,
    );
  }

  /** 06:35 Tashkent — morning video status to filadmin Telegram. */
  @Cron('35 6 * * *', {
    name: 'filadmin_video_morning_0630',
    timeZone: 'Asia/Tashkent',
  })
  async runFiladminVideoMorning0630() {
    this.logger.log('Cron: filadmin_video_morning_0630');
    try {
      await this.sendFiladminVideoReports('Ertalab 06:30 holati', false);
    } catch (err) {
      this.logger.error(
        `filadmin_video_morning_0630 failed: ${(err as Error).message}`,
      );
    }
  }

  /** 10:00 Tashkent — follow-up morning video status to filadmin. */
  @Cron('0 10 * * *', {
    name: 'filadmin_video_morning_1000',
    timeZone: 'Asia/Tashkent',
  })
  async runFiladminVideoMorning1000() {
    this.logger.log('Cron: filadmin_video_morning_1000');
    try {
      await this.sendFiladminVideoReports('Ertalab 10:00 — yakuniy', true);
    } catch (err) {
      this.logger.error(
        `filadmin_video_morning_1000 failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 18:00 Tashkent — mark missed for any student who hasn't submitted
   * a morning video AND hasn't sent a late one before the evening
   * window opens. The on-time morning window closed at 06:30 but late
   * submissions remain accepted until 18:00; running the mark-missed
   * any earlier would label late students as missed by mistake.
   */
  @Cron('0 18 * * *', {
    name: 'video_morning_mark_missed',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoMorningMarkMissed() {
    this.logger.log('Cron: video_morning_mark_missed');
    try {
      await this.videoCheckin.markAllMissedForWindow('morning');
    } catch (err) {
      this.logger.error(
        `video_morning_mark_missed failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 17:55 Tashkent — "Kechki video vaqti yetdi" reminder.
   */
  @Cron('55 17 * * *', {
    name: 'video_evening_start_reminder',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoEveningStartReminder() {
    this.logger.log('Cron: video_evening_start_reminder');
    const bot = this.telegram.getBot();
    if (!bot) return;
    try {
      const recipients =
        await this.videoCheckin.getReminderRecipients('evening');
      const msg =
        'Kechki video tashlash vaqti yetdi (18:00–22:00). Iltimos, video yuboring!';
      await Promise.allSettled(
        recipients.map((r) =>
          this.videoCheckinHandler.sendReminder(bot, r.telegramId, msg),
        ),
      );
      this.logger.log(
        `video_evening_start_reminder: ${recipients.length} ta yuborildi`,
      );
    } catch (err) {
      this.logger.error(
        `video_evening_start_reminder failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 21:55 Tashkent — "5 daqiqa qoldi" evening last-call reminder.
   */
  @Cron('55 21 * * *', {
    name: 'video_evening_lastcall_reminder',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoEveningLastcallReminder() {
    this.logger.log('Cron: video_evening_lastcall_reminder');
    const bot = this.telegram.getBot();
    if (!bot) return;
    try {
      const recipients =
        await this.videoCheckin.getReminderRecipients('evening');
      const msg =
        'Kechki video vaqti tugayapti — 5 daqiqa qoldi! Tez video yuboring.';
      await Promise.allSettled(
        recipients.map((r) =>
          this.videoCheckinHandler.sendReminder(bot, r.telegramId, msg),
        ),
      );
      this.logger.log(
        `video_evening_lastcall_reminder: ${recipients.length} ta yuborildi`,
      );
    } catch (err) {
      this.logger.error(
        `video_evening_lastcall_reminder failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 00:00 Tashkent — mark missed for any student who hasn't submitted
   * an evening video AND didn't send a late one before midnight. The
   * on-time evening window closed at 22:00 but late submissions remain
   * accepted until 00:00; this cron fires right after the late grace
   * cutoff so a missed mark survives.
   */
  @Cron('59 23 * * *', {
    name: 'video_evening_mark_missed',
    timeZone: 'Asia/Tashkent',
  })
  async runVideoEveningMarkMissed() {
    this.logger.log('Cron: video_evening_mark_missed');
    try {
      await this.videoCheckin.markAllMissedForWindow('evening');
    } catch (err) {
      this.logger.error(
        `video_evening_mark_missed failed: ${(err as Error).message}`,
      );
    }
  }

  // ── End video check-in crons ─────────────────────────────────────────────

  /**
   * Sundays at 04:00 — purge group chat messages older than 90 days,
   * preserving pinned messages (admins / staff often pin announcements).
   */
  @Cron('0 4 * * 0', { name: 'chat_90day_cleanup' })
  async runChat90DayCleanup() {
    this.logger.log({ event: 'chat_90day_cleanup.start' });
    try {
      const cutoff = new Date(Date.now() - 90 * 86_400_000);
      const result = await this.prisma.groupMessage.deleteMany({
        where: { createdAt: { lt: cutoff }, isPinned: false },
      });
      this.logger.log({
        event: 'chat_90day_cleanup.done',
        deleted: result.count,
      });
    } catch (err) {
      this.logger.error(`chat_90day_cleanup.failed: ${(err as Error).message}`);
    }
  }

  /**
   * §7.1 — Award XP for expired group challenges.
   *
   * Daily at 01:05 (just after `payment_unblock` / `delegation_complete`
   * which both run at 01:00) we look at every active GroupChallenge whose
   * `endDate` has passed and that has not yet had a winner stamped:
   *
   *   - winner is whichever side has higher cumulative `groupAXp` /
   *     `groupBXp` (ties → groupA wins, matching `addXp` semantics)
   *   - every active student with `branchId === winnerGroupId` gets
   *     `XP_AMOUNTS.CHALLENGE_WINNER` (+500)
   *   - every active student with `branchId === loserGroupId` gets
   *     `XP_AMOUNTS.CHALLENGE_CONSOLATION` (+100)
   *   - the challenge row is updated with `winnerGroupId` + `status='completed'`
   *   - a `feed.challenge_won` event is emitted for the social feed
   *
   * NOTE on group identity: the schema does NOT have a Group model; the
   * `groupAId / groupBId` columns store the `branchId` used by the rest
   * of the platform (group challenges are branch-vs-branch). That is the
   * mapping used here.
   */
  @Cron('5 1 * * *', { name: 'group_challenge_complete' })
  async runGroupChallengeComplete() {
    this.logger.log({ event: 'group_challenge_complete.start' });
    try {
      const expired = await this.prisma.groupChallenge.findMany({
        where: {
          status: 'active',
          endDate: { lt: new Date() },
          winnerGroupId: null,
        },
      });

      let processed = 0;
      for (const c of expired) {
        const winnerGroupId =
          c.groupAXp >= c.groupBXp ? c.groupAId : c.groupBId;
        const loserGroupId = c.groupAXp >= c.groupBXp ? c.groupBId : c.groupAId;

        await this.prisma.groupChallenge.update({
          where: { id: c.id },
          data: { winnerGroupId, status: 'completed' },
        });

        // Look up branch names so the feed event can render nicely.
        const [winnerBranch, loserBranch] = await Promise.all([
          this.prisma.branch
            .findUnique({
              where: { id: winnerGroupId },
              select: { name: true },
            })
            .catch(() => null),
          this.prisma.branch
            .findUnique({
              where: { id: loserGroupId },
              select: { name: true },
            })
            .catch(() => null),
        ]);

        this.events?.emit('feed.challenge_won', {
          challengeId: c.id,
          tenantId: c.tenantId,
          winnerGroupId,
          loserGroupId,
          winnerGroupName: winnerBranch?.name ?? winnerGroupId,
          loserGroupName: loserBranch?.name ?? loserGroupId,
        });

        processed++;
      }

      this.logger.log({
        event: 'group_challenge_complete.done',
        processed,
      });
    } catch (err) {
      this.logger.error(
        `group_challenge_complete.failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * 25.K.3: Weekly Monday 09:00 — alert superadmins about lessons whose
   * student academy-completion rate fell below 50% over the last 7 days.
   */
  @Cron('0 9 * * 1', { name: 'low_pass_rate_weekly' })
  async runLowPassRateAlert() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const lessons = await this.prisma.lesson.findMany({
        where: { isPublished: true },
        select: { id: true, title: true, tenantId: true },
      });

      const lowOnes: Array<{ title: string; rate: number; tenantId: string }> =
        [];
      for (const l of lessons) {
        const total = await this.prisma.studentProgress.count({
          where: { lessonId: l.id, lastActivityAt: { gte: sevenDaysAgo } },
        });
        if (total < 5) continue; // ignore tiny samples
        const passed = await this.prisma.studentProgress.count({
          where: {
            lessonId: l.id,
            lastActivityAt: { gte: sevenDaysAgo },
            academyCompleted: true,
          },
        });
        const rate = Math.round((passed / total) * 100);
        if (rate < 50) {
          lowOnes.push({ title: l.title, rate, tenantId: l.tenantId });
        }
      }

      if (lowOnes.length === 0) return;

      const superadmins = await this.prisma.user.findMany({
        where: {
          role: 'superadmin',
          status: 'active',
          telegramId: { not: null },
        },
        select: { telegramId: true, tenantId: true },
      });
      for (const sa of superadmins) {
        if (!sa.telegramId) continue;
        const tenantLow = lowOnes
          .filter((x) => x.tenantId === sa.tenantId)
          .slice(0, 5);
        if (tenantLow.length === 0) continue;
        const list = tenantLow
          .map((x) => `• ${x.title}: ${x.rate}%`)
          .join('\n');
        await this.telegram
          .sendMessage(sa.telegramId, `[Haftalik] Pass-rate <50%:\n${list}`)
          .catch(() => undefined);
      }
    } catch (err) {
      this.logger.error(
        `low_pass_rate_weekly.failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Nightly churn-model retrain. Best-effort: the ml-service is an
   * optional, separately deployed Python service — if ML_SERVICE_URL is
   * unset or the call fails, the superadmin churn list still works
   * (it's rule-based in ChurnService). We only log; never throw.
   */
  @Cron('0 5 * * *', { name: 'ml_training', timeZone: 'Asia/Tashkent' })
  async runMlTraining() {
    const base = (process.env.ML_SERVICE_URL ?? '').replace(/\/+$/, '');
    if (!base) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120_000);
    try {
      const res = await fetch(`${base}/train`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: ctrl.signal,
      });
      if (!res.ok) {
        this.logger.warn(`ml_training: ml-service HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { modelVersion?: string };
      this.logger.log(
        `ml_training: model trained (${data.modelVersion ?? 'unknown'})`,
      );
    } catch (err) {
      this.logger.warn(
        `ml_training skipped/failed: ${(err as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
