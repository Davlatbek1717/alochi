import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FeedEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialGateway } from './social.gateway';

const ALLOWED_FEED_EMOJIS = ['👍', '🎉', '💪', '🔥', '❤️'];

@Injectable()
export class FeedEventService {
  constructor(
    private prisma: PrismaService,
    private gateway: SocialGateway,
  ) {}

  async addReaction(eventId: string, userId: string, emoji: string) {
    if (!ALLOWED_FEED_EMOJIS.includes(emoji)) {
      throw new BadRequestException(
        `Faqat quyidagi emoji ruxsat: ${ALLOWED_FEED_EMOJIS.join(' ')}`,
      );
    }
    const event = await this.prisma.socialFeedEvent.findUnique({
      where: { id: eventId },
      select: { id: true, actorId: true },
    });
    if (!event) throw new NotFoundException('Event topilmadi');

    const reaction = await this.prisma.feedEventReaction.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, emoji },
      update: { emoji },
    });

    this.gateway.emitToUser(event.actorId, 'feed:reaction', {
      eventId,
      userId,
      emoji,
    });

    return reaction;
  }

  async getReactions(eventId: string) {
    return this.prisma.feedEventReaction.findMany({ where: { eventId } });
  }

  async emit(
    tenantId: string,
    actorId: string,
    eventType: FeedEventType,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const event = (await this.prisma.socialFeedEvent.create({
      data: { tenantId, actorId, eventType, meta: meta as any },
      include: { actor: { select: { name: true } } },
    })) as { createdAt: Date; actor?: { name: string } | null };

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
