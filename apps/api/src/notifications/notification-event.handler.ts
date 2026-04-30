import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const DEFAULT_WARNING_BLOCK_LIMIT = 3;

/**
 * In-app notification fan-out for domain events. Telegram delivery is
 * handled separately in `apps/api/src/telegram/handlers/*` so a Telegram
 * outage cannot block the in-app notification feed and vice-versa.
 */
@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private notifications: NotificationsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Spec §6.2 in-app side:
   *   count === 1                → student in-app only.
   *   count === 2                → student + branch mentor in-app alert.
   *   count >= warningBlockLimit → student in-app (block notice fires via
   *                                `student.blocked` separately).
   */
  @OnEvent('warning.given')
  async onWarningGiven(payload: { studentId: string; count: number }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: { name: true, branchId: true, tenantId: true },
      });
      if (!student) return;

      await this.notifications.send(
        payload.studentId,
        'warning',
        `${payload.count} ta ogohlantirish`,
        `Siz ${payload.count} ta ogohlantirish oldingiz. 3 ta bo'lsa hisobingiz bloklanadi.`,
        { count: payload.count },
      );

      if (payload.count === 2 && student.branchId) {
        const mentor = await this.prisma.user.findFirst({
          where: {
            branchId: student.branchId,
            role: 'mentor',
            status: 'active',
          },
          select: { id: true },
        });
        if (mentor) {
          await this.notifications.send(
            mentor.id,
            'warning_alert',
            'Ogohlantirish kuzatuvi',
            `${student.name} 2-ogohlantirishni oldi. Diqqat bilan kuzating.`,
            { studentId: payload.studentId, count: 2 },
          );
        }
      }
    } catch (err) {
      this.logger.error('warning.given notification error', err);
    }
  }

  @OnEvent('student.blocked')
  async onStudentBlocked(payload: {
    studentId: string;
    reason: string;
    activeCount?: number;
  }) {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: payload.studentId },
        select: { name: true, tenantId: true },
      });
      if (!student) return;

      await this.notifications.send(
        payload.studentId,
        'blocked',
        'Hisob bloklandi',
        `Hisobingiz ${payload.reason === 'warning' ? '3 ta ogohlantirish sababli' : "to'lov amalga oshirilmaganligi sababli"} bloklandi.`,
        { reason: payload.reason },
      );

      // Escalation in-app to filadmin + superadmin.
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: student.tenantId },
        select: { warningBlockLimit: true },
      });
      const blockLimit =
        tenant?.warningBlockLimit ?? DEFAULT_WARNING_BLOCK_LIMIT;

      const escalationTargets = await this.prisma.user.findMany({
        where: {
          tenantId: student.tenantId,
          role: { in: ['filadmin', 'superadmin'] },
          status: 'active',
        },
        select: { id: true },
      });

      await Promise.all(
        escalationTargets.map((target) =>
          this.notifications.send(
            target.id,
            'student_blocked',
            'Talaba bloklandi',
            `${student.name} hisobi ${payload.reason === 'warning' ? `${blockLimit} ta ogohlantirish` : "to'lov"} sababli bloklandi.`,
            { studentId: payload.studentId, reason: payload.reason },
          ),
        ),
      );
    } catch (err) {
      this.logger.error('student.blocked notification error', err);
    }
  }

  @OnEvent('delegation.created')
  async onDelegationCreated(payload: {
    toUserId: string;
    fromUserName: string;
    role: string;
    endsAt: string;
  }) {
    try {
      await this.notifications.send(
        payload.toUserId,
        'delegation',
        'Yangi delegatsiya',
        `${payload.fromUserName} sizga ${payload.role} rolini delegatsiya qildi.`,
        { fromUserName: payload.fromUserName, endsAt: payload.endsAt },
      );
    } catch (err) {
      this.logger.error('delegation.created notification error', err);
    }
  }

  @OnEvent('delegation.accepted')
  async onDelegationAccepted(payload: {
    fromUserId: string;
    toUserName: string;
  }) {
    try {
      await this.notifications.send(
        payload.fromUserId,
        'delegation',
        'Delegatsiya qabul qilindi',
        `${payload.toUserName} delegatsiyangizni qabul qildi.`,
        { toUserName: payload.toUserName },
      );
    } catch (err) {
      this.logger.error('delegation.accepted notification error', err);
    }
  }

  @OnEvent('delegation.rejected')
  async onDelegationRejected(payload: {
    fromUserId: string;
    toUserName: string;
  }) {
    try {
      await this.notifications.send(
        payload.fromUserId,
        'delegation',
        'Delegatsiya rad etildi',
        `${payload.toUserName} delegatsiyangizni rad etdi.`,
        { toUserName: payload.toUserName },
      );
    } catch (err) {
      this.logger.error('delegation.rejected notification error', err);
    }
  }

  @OnEvent('delegation.cancelled')
  async onDelegationCancelled(payload: {
    toUserId: string;
    fromUserName: string;
  }) {
    try {
      await this.notifications.send(
        payload.toUserId,
        'delegation',
        'Delegatsiya bekor qilindi',
        `${payload.fromUserName} delegatsiyani bekor qildi.`,
        { fromUserName: payload.fromUserName },
      );
    } catch (err) {
      this.logger.error('delegation.cancelled notification error', err);
    }
  }

  @OnEvent('delegation.completed')
  async onDelegationCompleted(payload: {
    fromUserId: string;
    toUserId: string;
  }) {
    try {
      await Promise.all([
        this.notifications.send(
          payload.fromUserId,
          'delegation',
          'Delegatsiya yakunlandi',
          'Delegatsiya muddati tugadi.',
          {},
        ),
        this.notifications.send(
          payload.toUserId,
          'delegation',
          'Delegatsiya yakunlandi',
          'Delegatsiya muddati tugadi.',
          {},
        ),
      ]);
    } catch (err) {
      this.logger.error('delegation.completed notification error', err);
    }
  }
}
