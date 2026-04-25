import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialGateway } from './social.gateway';

@Injectable()
export class FeedEventService {
  constructor(
    private prisma: PrismaService,
    private gateway: SocialGateway,
  ) {}

  async emit(
    tenantId: string,
    actorId: string,
    eventType: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const event = await this.prisma.socialFeedEvent.create({
      data: { tenantId, actorId, eventType, meta: meta as any },
      include: { actor: { select: { name: true } } },
    });

    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId: actorId }, { friendId: actorId }],
      },
    });

    const friendIds = friendships.map((f: any) =>
      f.userId === actorId ? f.friendId : f.userId,
    );

    if (friendIds.length > 0) {
      this.gateway.broadcastFeedEvent(friendIds, {
        type: eventType,
        data: {
          actorId,
          actorName: event.actor?.name,
          meta,
          createdAt: event.createdAt.toISOString(),
        },
      });
    }
  }
}
