import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationEventHandler {
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(private notifications: NotificationsService) {}

  @OnEvent('warning.given')
  async onWarningGiven(payload: { studentId: string; count: number }) {
    try {
      await this.notifications.send(
        payload.studentId,
        'warning',
        `${payload.count} ta ogohlantirish`,
        `Siz ${payload.count} ta ogohlantirish oldingiz. 3 ta bo'lsa hisobingiz bloklanadi.`,
        { count: payload.count },
      );
    } catch (err) {
      this.logger.error('warning.given notification error', err);
    }
  }

  @OnEvent('student.blocked')
  async onStudentBlocked(payload: { studentId: string; reason: string }) {
    try {
      await this.notifications.send(
        payload.studentId,
        'blocked',
        'Hisob bloklandi',
        `Hisobingiz ${payload.reason === 'warning' ? '3 ta ogohlantirish sababli' : "to'lov amalga oshirilmaganligi sababli"} bloklandi.`,
        { reason: payload.reason },
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
}
