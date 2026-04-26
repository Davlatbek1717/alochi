import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  @OnEvent('warning.given')
  async onWarningGiven(payload: { studentId: string; count: number; warning: { reasonText: string } }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: { name: true, telegramId: true, branchId: true, tenantId: true },
      });
      if (!student) return;

      const msg = this.telegram.formatWarningNotification(student.name, payload.count, payload.warning.reasonText);

      if (student.telegramId) {
        await this.telegram.sendMessage(student.telegramId, msg);
      }

      if (payload.count >= 2 && student.branchId) {
        const mentor = await this.prisma.user.findFirst({
          where: { branchId: student.branchId, role: 'mentor', telegramId: { not: null } },
          select: { telegramId: true },
        });
        if (mentor?.telegramId) {
          await this.telegram.sendMessage(mentor.telegramId, msg);
        }
      }
    } catch (err) {
      this.logger.error(`warning.given handler xatosi: ${err}`);
    }
  }

  @OnEvent('student.blocked')
  async onStudentBlocked(payload: { studentId: string; reason: string; activeCount: number }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: { name: true, telegramId: true, tenantId: true },
      });
      if (!student) return;

      const msg = this.telegram.formatWarningNotification(student.name, payload.activeCount, payload.reason);

      if (student.telegramId) {
        await this.telegram.sendMessage(student.telegramId, msg);
      }

      const admins = await this.prisma.user.findMany({
        where: {
          tenantId: student.tenantId,
          role: { in: ['filadmin', 'superadmin'] },
          telegramId: { not: null },
        },
        select: { telegramId: true },
      });
      await Promise.all(admins.map((a) => this.telegram.sendMessage(a.telegramId!, msg)));
    } catch (err) {
      this.logger.error(`student.blocked handler xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.created')
  async onDelegationCreated(payload: { toUserId: string; fromUserName: string; role: string; endsAt: string; reason: string }) {
    try {
      const recipient = await this.prisma.user.findUnique({
        where: { id: payload.toUserId },
        select: { telegramId: true },
      });
      if (!recipient?.telegramId) return;

      const msg = [
        `📋 <b>Yangi delegatsiya</b>`,
        `Kim berdi: ${payload.fromUserName}`,
        `Rol: ${payload.role}`,
        `Sabab: ${payload.reason}`,
        `Muddat: ${payload.endsAt}`,
      ].join('\n');

      await this.telegram.sendMessage(recipient.telegramId, msg);
    } catch (err) {
      this.logger.error(`delegation.created handler xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.rejected')
  async onDelegationRejected(payload: { fromUserId: string; toUserName: string; reason: string }) {
    try {
      const sender = await this.prisma.user.findUnique({
        where: { id: payload.fromUserId },
        select: { telegramId: true },
      });
      if (!sender?.telegramId) return;

      const msg = [
        `❌ <b>Delegatsiya rad etildi</b>`,
        `Kim tomonidan: ${payload.toUserName}`,
        `Sabab: ${payload.reason}`,
      ].join('\n');

      await this.telegram.sendMessage(sender.telegramId, msg);
    } catch (err) {
      this.logger.error(`delegation.rejected handler xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.cancelled')
  async onDelegationCancelled(payload: { toUserId: string; fromUserName: string; reason: string }) {
    try {
      const recipient = await this.prisma.user.findUnique({
        where: { id: payload.toUserId },
        select: { telegramId: true },
      });
      if (!recipient?.telegramId) return;

      const msg = [
        `🚫 <b>Delegatsiya bekor qilindi</b>`,
        `Kim tomonidan: ${payload.fromUserName}`,
        `Sabab: ${payload.reason}`,
      ].join('\n');

      await this.telegram.sendMessage(recipient.telegramId, msg);
    } catch (err) {
      this.logger.error(`delegation.cancelled handler xatosi: ${err}`);
    }
  }
}
