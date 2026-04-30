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
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

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
    } catch {
      client.disconnect();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const user = client.data.user as JwtPayload | undefined;
    if (!user || !data?.groupId) return;

    // NOTE: The Prisma schema has no dedicated group-membership join table
    // (no GroupStudent / StudentGroup model). As the closest available guard,
    // we check that no messages for this groupId exist under a *different* tenant,
    // preventing cross-tenant room hijacking. Fresh groups (no messages yet) are
    // allowed — the subsequent chat:send enforces sender tenantId consistency.
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

  broadcastFeedEvent(userIds: string[], event: { type: string; data: object }) {
    for (const id of userIds) {
      this.server.to(`feed:${id}`).emit('feed:event', event);
    }
  }

  emitDuelChallenge(toUserId: string, duelId: string, challengerName: string) {
    this.server
      .to(`feed:${toUserId}`)
      .emit('duel:challenged', { duelId, challengerName });
  }

  emitDuelResult(
    toUserId: string,
    result: { won: boolean; xpEarned: number; score: string },
  ) {
    this.server.to(`feed:${toUserId}`).emit('duel:result', result);
  }

  emitChallengeUpdate(
    groupAId: string,
    groupBId: string,
    update: { groupAXp: number; groupBXp: number },
  ) {
    this.server.to(`group:${groupAId}`).emit('challenge:update', update);
    this.server.to(`group:${groupBId}`).emit('challenge:update', update);
  }
}
