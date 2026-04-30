import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

@Injectable()
export class GamificationTelegramHandler {
  private readonly logger = new Logger(GamificationTelegramHandler.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /**
   * Spec §6.4 — 30-day streak milestone parent congratulations.
   * StreakService emits this event when `currentStreak === 30` (after the
   * day's increment).
   */
  @OnEvent('streak.milestone30')
  async onStreakMilestone30(payload: { studentId: string; tenantId?: string }) {
    try {
      await this.telegram.sendToParent(
        payload.studentId,
        'streak.milestone30',
        {},
        payload.tenantId,
      );
    } catch (err) {
      this.logger.error(`streak.milestone30 Telegram xatosi: ${err}`);
    }
  }

  /**
   * Spec §6.5 — certificate earned: congratulate the student and the parent.
   * Cert PNG attachment (Phase 20) will piggy-back on this same event.
   */
  @OnEvent('certificate.earned')
  async onCertificateEarned(payload: {
    studentId: string;
    certName: string;
    tenantId?: string;
  }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: { name: true, telegramId: true, tenantId: true },
      });
      if (!student) return;

      const tenantId = payload.tenantId ?? student.tenantId;

      if (student.telegramId) {
        await this.telegram.sendTemplate(
          student.telegramId,
          'certificate.earned.student',
          { certName: payload.certName },
          tenantId,
        );
      }

      await this.telegram.sendToParent(
        payload.studentId,
        'certificate.earned.parent',
        { certName: payload.certName, studentName: student.name },
        tenantId,
      );
    } catch (err) {
      this.logger.error(`certificate.earned Telegram xatosi: ${err}`);
    }
  }
}
