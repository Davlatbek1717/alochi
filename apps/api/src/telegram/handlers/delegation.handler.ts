import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram.service';

const PERMISSION_LABELS: Record<string, string> = {
  warnings: 'ogohlantirish berish',
  payments: "to'lov belgilash",
  staff_manage: "xodim qo'shish",
};

function formatPermissions(permissions: string[] | undefined): string {
  if (!permissions || permissions.length === 0) return '';
  return permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(', ');
}

interface DelegationCreatedPayload {
  delegationId?: string;
  toUserId: string;
  fromUserId?: string;
  fromUserName?: string;
  role: string;
  permissions?: string[];
  endsAt: string;
  reason: string;
  tenantId?: string;
}

interface DelegationAcceptedPayload {
  delegationId?: string;
  fromUserId: string;
  toUserName: string;
  acceptanceReason?: string;
  tenantId?: string;
}

interface DelegationRejectedPayload {
  delegationId?: string;
  fromUserId: string;
  toUserName: string;
  rejectionReason?: string;
  reason?: string;
  tenantId?: string;
}

interface DelegationCancelledPayload {
  delegationId?: string;
  toUserId: string;
  cancelledBy: string;
  fromUserName?: string;
  role?: string;
  reason?: string;
  tenantId?: string;
}

interface DelegationCompletedPayload {
  delegationId: string;
  fromUserId: string;
  toUserId: string;
  tenantId?: string;
}

/**
 * Centralised Telegram delivery for delegation lifecycle events. Listens to
 * the same events as `NotificationEventHandler` (which produces the in-app
 * Notification rows) — both run in parallel so a Telegram delivery failure
 * never blocks the in-app feed and vice-versa.
 *
 * Spec §6.1 — Telegram body matn for each event.
 */
@Injectable()
export class DelegationHandler {
  private readonly logger = new Logger(DelegationHandler.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  @OnEvent('delegation.created')
  async onCreated(payload: DelegationCreatedPayload) {
    try {
      await this.telegram.sendToUser(
        payload.toUserId,
        'delegation.created',
        {
          role: payload.role,
          fromUserName: payload.fromUserName ?? '',
          permissionsList: formatPermissions(payload.permissions),
          reason: payload.reason,
          endsAt: payload.endsAt,
        },
        payload.tenantId,
      );
    } catch (err) {
      this.logger.error(`delegation.created Telegram xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.accepted')
  async onAccepted(payload: DelegationAcceptedPayload) {
    try {
      await this.telegram.sendToUser(
        payload.fromUserId,
        'delegation.accepted',
        {
          toUserName: payload.toUserName,
          acceptanceReason: payload.acceptanceReason ?? '',
        },
        payload.tenantId,
      );
    } catch (err) {
      this.logger.error(`delegation.accepted Telegram xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.rejected')
  async onRejected(payload: DelegationRejectedPayload) {
    try {
      await this.telegram.sendToUser(
        payload.fromUserId,
        'delegation.rejected',
        {
          toUserName: payload.toUserName,
          rejectionReason: payload.rejectionReason ?? payload.reason ?? '',
        },
        payload.tenantId,
      );
    } catch (err) {
      this.logger.error(`delegation.rejected Telegram xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.cancelled')
  async onCancelled(payload: DelegationCancelledPayload) {
    try {
      let cancelledByName = '';
      if (payload.cancelledBy) {
        const cancelledByUser = await this.prisma.user.findUnique({
          where: { id: payload.cancelledBy },
          select: { name: true },
        });
        cancelledByName = cancelledByUser?.name ?? payload.fromUserName ?? '';
      }
      await this.telegram.sendToUser(
        payload.toUserId,
        'delegation.cancelled',
        {
          role: payload.role ?? '',
          cancelledBy: cancelledByName,
          reason: payload.reason ?? '',
        },
        payload.tenantId,
      );
    } catch (err) {
      this.logger.error(`delegation.cancelled Telegram xatosi: ${err}`);
    }
  }

  @OnEvent('delegation.completed')
  async onCompleted(payload: DelegationCompletedPayload) {
    try {
      await Promise.all([
        this.telegram.sendToUser(
          payload.fromUserId,
          'delegation.completed',
          {},
          payload.tenantId,
        ),
        this.telegram.sendToUser(
          payload.toUserId,
          'delegation.completed',
          {},
          payload.tenantId,
        ),
      ]);
    } catch (err) {
      this.logger.error(`delegation.completed Telegram xatosi: ${err}`);
    }
  }
}
