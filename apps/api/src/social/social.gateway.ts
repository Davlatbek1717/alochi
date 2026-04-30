import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

/**
 * SocialGateway — single Socket.IO namespace `/social` that
 *   1) handles inbound chat/feed events (existing),
 *   2) forwards domain events emitted via EventEmitter2 to the right
 *      WebSocket rooms.
 *
 * Frontend devs — emitted events you can listen for (auto-forwarded from
 * EventEmitter2 domain events, see @OnEvent handlers below):
 *   - status:updated      payload: { studentId, color, changedBy, timestamp }
 *   - student:blocked     payload: { studentId, reason, timestamp }
 *   - student:unblocked   payload: { studentId, by, timestamp }
 *   - notification:new    payload: { userId, type, title, body, createdAt }
 *   - attendance:marked   payload: { studentId, lessonId, status, timestamp }
 *   - task:assigned       payload: { taskId, assigneeId, createdBy, deadline, title }
 *   - chat:reaction       payload: { messageId, userId, emoji }
 *
 * Wiring frontend hooks (e.g. `useNotifications` listening for `notification:new`)
 * is OUT OF SCOPE for Phase 3 — services emit cleanly here so it can land later.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/social' })
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify(token) as JwtPayload;
      client.data.user = payload;
      client.join(`feed:${payload.userId}`);
      client.join(`tenant:${payload.tenantId}`);
    } catch {
      client.disconnect();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_client: Socket) {}

  // ── Inbound events ──────────────────────────────────────────────────────

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const user = client.data.user as JwtPayload | undefined;
    if (!user || !data?.groupId) return;

    const alienMessage = await this.prisma.groupMessage.findFirst({
      where: {
        groupId: data.groupId,
        tenantId: { not: user.tenantId },
      },
      select: { id: true },
    });
    if (alienMessage) return;

    client.join(`group:${data.groupId}`);
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; content: string },
  ) {
    const user = client.data.user as JwtPayload | undefined;
    if (!user) return;

    try {
      const msg = await this.chat.sendMessage({
        tenantId: user.tenantId,
        groupId: data.groupId,
        senderId: user.userId,
        content: data.content,
      });

      this.server.to(`group:${data.groupId}`).emit('chat:message', {
        id: msg.id,
        senderId: msg.senderId,
        content: msg.content,
        senderName: msg.sender.name,
        createdAt: msg.createdAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('chat:error', { message });
    }
  }

  @SubscribeMessage('feed:subscribe')
  handleFeedSubscribe(@ConnectedSocket() client: Socket) {
    const user = client.data.user as JwtPayload | undefined;
    if (user?.userId) {
      client.join(`feed:${user.userId}`);
    }
  }

  // ── Direct emit helpers (for code that needs synchronous emit) ──────────

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`feed:${userId}`).emit(event, payload);
  }

  emitToTenant(tenantId: string, event: string, payload: unknown) {
    this.server?.to(`tenant:${tenantId}`).emit(event, payload);
  }

  broadcastFeedEvent(userIds: string[], event: { type: string; data: object }) {
    for (const id of userIds) {
      this.server?.to(`feed:${id}`).emit('feed:event', event);
    }
  }

  emitDuelChallenge(toUserId: string, duelId: string, challengerName: string) {
    this.server
      ?.to(`feed:${toUserId}`)
      .emit('duel:challenged', { duelId, challengerName });
  }

  emitDuelResult(
    toUserId: string,
    result: { won: boolean; xpEarned: number; score: string },
  ) {
    this.server?.to(`feed:${toUserId}`).emit('duel:result', result);
  }

  emitChallengeUpdate(
    groupAId: string,
    groupBId: string,
    update: { groupAXp: number; groupBXp: number },
  ) {
    this.server?.to(`group:${groupAId}`).emit('challenge:update', update);
    this.server?.to(`group:${groupBId}`).emit('challenge:update', update);
  }

  // ── Domain-event → WebSocket forwarders ────────────────────────────────

  /** Uzbek (yashil/sariq/qizil) → English color name. */
  private mapStatusColor(
    uz?: string | null,
  ): 'green' | 'yellow' | 'red' | null {
    switch (uz) {
      case 'yashil':
        return 'green';
      case 'sariq':
        return 'yellow';
      case 'qizil':
        return 'red';
      default:
        return null;
    }
  }

  @OnEvent('status.updated')
  forwardStatusUpdated(payload: {
    studentId: string;
    color: string | null;
    changedBy: string;
    tenantId: string;
    timestamp: string;
  }) {
    const englishColor = this.mapStatusColor(payload.color);
    this.emitToUser(payload.studentId, 'status:updated', {
      studentId: payload.studentId,
      color: englishColor,
      changedBy: payload.changedBy,
      timestamp: payload.timestamp,
    });
    this.emitToTenant(payload.tenantId, 'status:updated', {
      studentId: payload.studentId,
      color: englishColor,
      changedBy: payload.changedBy,
      timestamp: payload.timestamp,
    });
  }

  @OnEvent('student.blocked')
  forwardStudentBlocked(payload: {
    studentId: string;
    reason: 'warning' | 'payment' | string;
    activeCount?: number;
  }) {
    const reason: 'warning' | 'payment' =
      payload.reason === 'payment' ? 'payment' : 'warning';
    this.emitToUser(payload.studentId, 'student:blocked', {
      studentId: payload.studentId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent('student.unblocked')
  forwardStudentUnblocked(payload: {
    studentId: string;
    by: string;
    timestamp?: string;
  }) {
    this.emitToUser(payload.studentId, 'student:unblocked', {
      studentId: payload.studentId,
      by: payload.by,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  @OnEvent('notification.new')
  forwardNotificationNew(payload: {
    userId: string;
    type: string;
    title: string;
    body: string;
    createdAt: string;
  }) {
    this.emitToUser(payload.userId, 'notification:new', payload);
  }

  @OnEvent('attendance.marked')
  forwardAttendanceMarked(payload: {
    studentId: string;
    lessonId?: string | null;
    status: string;
    timestamp: string;
  }) {
    this.emitToUser(payload.studentId, 'attendance:marked', payload);
  }

  @OnEvent('task.assigned')
  forwardTaskAssigned(payload: {
    taskId: string;
    assigneeId: string;
    createdBy: string;
    deadline?: string | null;
    title: string;
  }) {
    this.emitToUser(payload.assigneeId, 'task:assigned', payload);
  }

  @OnEvent('chat.reaction')
  forwardChatReaction(payload: {
    messageId: string;
    userId: string;
    emoji: string;
    groupId?: string;
  }) {
    if (payload.groupId) {
      this.server?.to(`group:${payload.groupId}`).emit('chat:reaction', {
        messageId: payload.messageId,
        userId: payload.userId,
        emoji: payload.emoji,
      });
    } else {
      this.emitToUser(payload.userId, 'chat:reaction', payload);
    }
  }
}
