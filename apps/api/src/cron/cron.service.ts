import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdaptiveService } from '../adaptive/adaptive.service';
import { ChurnService } from '../churn/churn.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
    private adaptive: AdaptiveService,
    private churn: ChurnService,
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

      this.logger.log(`Tenant ${setting.tenantId}: ${result.count} o'quvchi bloklandi`);
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

    const result = await this.prisma.delegation.updateMany({
      where: {
        status: 'active',
        endsAt: { lte: now },
      },
      data: { status: 'completed' },
    });

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

      this.logger.log(`Tenant ${setting.tenantId}: ${unpaidStudents.length} ta eslatma yuborildi`);
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
      await this.notifications.send(
        d.fromUser.id,
        'delegation',
        'Delegatsiya tugayapti',
        `${d.toUser.name} ga delegatsiyangiz ertaga tugaydi.`,
      ).catch(() => {});

      await this.notifications.send(
        d.toUser.id,
        'delegation',
        'Delegatsiya tugayapti',
        `${d.fromUser.name} dan delegatsiya ertaga tugaydi.`,
      ).catch(() => {});
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
          select: { englishStatus: true, personalStatus: true, criticalStatus: true },
        },
        studentProgress: {
          where: { completedAt: { gte: today, lt: tomorrow }, academyCompleted: true },
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
      await this.telegram.sendMessage(student.parentTelegramId, message).catch(() => {});
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
      select: { id: true, name: true, telegramId: true, branchId: true, tenantId: true },
    });

    for (const manager of managers) {
      if (!manager.telegramId) continue;

      const [redCount, yellowCount] = await Promise.all([
        this.prisma.studentStatus.count({
          where: {
            date: { gte: today, lt: tomorrow },
            student: { tenantId: manager.tenantId, branchId: manager.branchId ?? undefined },
            OR: [{ englishStatus: 'qizil' }, { personalStatus: 'qizil' }, { criticalStatus: 'qizil' }],
          },
        }),
        this.prisma.studentStatus.count({
          where: {
            date: { gte: today, lt: tomorrow },
            student: { tenantId: manager.tenantId, branchId: manager.branchId ?? undefined },
            OR: [{ englishStatus: 'sariq' }, { personalStatus: 'sariq' }, { criticalStatus: 'sariq' }],
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
          where: { branchId: fa.branchId, role: { in: ['mentor', 'manager', 'tester'] }, status: 'active' },
        }),
        this.prisma.attendanceStaff.count({
          where: { date: { gte: today, lt: tomorrow }, user: { branchId: fa.branchId }, loginTime: { not: null } },
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
      await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY lesson_stats_mv');
      await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY branch_stats_mv');
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
      await this.adaptive.runNightlyAdaptation(tenant.id).catch((e) =>
        this.logger.error(`Adaptive error tenant ${tenant.id}: ${e.message}`),
      );
    }
  }

  @Cron('0 6 * * *', { name: 'churn_scoring' })
  async runChurnScoring() {
    this.logger.log('Cron: churn scoring boshlanmoqda...');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      await this.churn.runDailyScoring(tenant.id).catch((e) =>
        this.logger.error(`Churn error tenant ${tenant.id}: ${e.message}`),
      );
    }
  }

  async triggerPaymentUnblockManually() {
    return this.runPaymentUnblock();
  }
}
