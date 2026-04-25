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

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/social' })
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify(token) as Record<string, unknown>;
      client.data.user = payload;
      if (payload.groupId) {
        client.join(`group:${payload.groupId}`);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {
    // cleanup handled by socket.io
  }

  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string; content: string },
  ) {
    const user = client.data.user as Record<string, string> | undefined;
    if (!user) return;

    try {
      const msg = await this.chat.sendMessage({
        tenantId: user.tenantId,
        groupId: data.groupId,
        senderId: user.userId,
        content: data.content,
      });

      this.server.to(`group:${data.groupId}`).emit('chat:message', {
        id: (msg as any).id,
        content: (msg as any).content,
        sender: (msg as any).sender,
        createdAt: (msg as any).createdAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.emit('chat:error', { message });
    }
  }

  @SubscribeMessage('feed:subscribe')
  handleFeedSubscribe(@ConnectedSocket() client: Socket) {
    const user = client.data.user as Record<string, string> | undefined;
    if (user?.userId) {
      client.join(`feed:${user.userId}`);
    }
  }

  broadcastFeedEvent(userIds: string[], event: { type: string; data: object }) {
    for (const id of userIds) {
      this.server.to(`feed:${id}`).emit('feed:event', event);
    }
  }
}
