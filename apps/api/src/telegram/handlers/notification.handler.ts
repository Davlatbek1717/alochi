import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

const DEFAULT_WARNING_BLOCK_LIMIT = 3;

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  /**
   * Spec §6.2 — count-differentiated warning Telegram delivery.
   *
   *   count === 1                → student-only Telegram (`warning.1`).
   *   count === 2                → parent Telegram (`warning.2`); mentor in-app
   *                                already arrives via NotificationEventHandler.
   *   count >= warningBlockLimit → parent Telegram (`warning.3`); filadmin +
   *                                superadmin in-app via student.blocked event.
   */
  @OnEvent('warning.given')
  async onWarningGiven(payload: {
    studentId: string;
    count: number;
    warning: { reasonText: string };
  }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: {
          name: true,
          telegramId: true,
          parentTelegramId: true,
          tenantId: true,
        },
      });
      if (!student) return;

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: student.tenantId },
        select: { warningBlockLimit: true },
      });
      const blockLimit =
        tenant?.warningBlockLimit ?? DEFAULT_WARNING_BLOCK_LIMIT;

      const reason = payload.warning.reasonText;

      if (payload.count === 1) {
        if (student.telegramId) {
          await this.telegram.sendTemplate(
            student.telegramId,
            'warning.1',
            { reason },
            student.tenantId,
          );
        }
      } else if (payload.count === 2) {
        if (student.telegramId) {
          await this.telegram.sendTemplate(
            student.telegramId,
            'warning.1',
            { reason },
            student.tenantId,
          );
        }
        if (student.parentTelegramId) {
          await this.telegram.sendTemplate(
            student.parentTelegramId,
            'warning.2',
            { studentName: student.name, reason },
            student.tenantId,
          );
        } else {
          this.logger.warn(
            `warning.2: student ${payload.studentId} parentTelegramId yo'q — parent xabari yuborilmadi`,
          );
        }
      } else if (payload.count >= blockLimit) {
        // Block-threshold copy. The student.blocked event also fires from
        // WarningsService and triggers the in-app filadmin / superadmin
        // notifications via NotificationEventHandler.
        if (student.parentTelegramId) {
          await this.telegram.sendTemplate(
            student.parentTelegramId,
            'warning.3',
            { studentName: student.name },
            student.tenantId,
          );
        } else {
          this.logger.warn(
            `warning.3: student ${payload.studentId} parentTelegramId yo'q — parent xabari yuborilmadi`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`warning.given handler xatosi: ${err}`);
    }
  }

  @OnEvent('student.blocked')
  async onStudentBlocked(payload: {
    studentId: string;
    reason: string;
    activeCount: number;
  }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: {
          name: true,
          telegramId: true,
          parentTelegramId: true,
          tenantId: true,
        },
      });
      if (!student) return;

      // Notify parent at the block threshold (warning.3 copy already covers
      // this for warning-driven blocks; payment-driven blocks use the legacy
      // warning summary template). Telegram-only — in-app handled elsewhere.
      if (student.parentTelegramId) {
        await this.telegram.sendTemplate(
          student.parentTelegramId,
          'warning.3',
          { studentName: student.name },
          student.tenantId,
        );
      }
    } catch (err) {
      this.logger.error(`student.blocked handler xatosi: ${err}`);
    }
  }

  // Delegation Telegram delivery moved to DelegationHandler (Phase 6 §6.1)
  // so all delegation copy is template-driven and centrally maintained.
}
