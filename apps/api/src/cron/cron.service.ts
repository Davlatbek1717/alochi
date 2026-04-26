import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
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

  async triggerPaymentUnblockManually() {
    return this.runPaymentUnblock();
  }
}
