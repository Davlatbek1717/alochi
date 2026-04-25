import { Injectable, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Friendship } from '@prisma/client';

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  async sendRequest(userId: string, friendId: string, branchId: string): Promise<Friendship> {
    const existing = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    if (existing) throw new ConflictException('Friend request already exists');

    return this.prisma.friendship.create({
      data: { userId, friendId, scope: branchId, status: 'pending' },
    });
  }

  async respond(requestId: string, userId: string, accept: boolean): Promise<Friendship> {
    const request = await this.prisma.friendship.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.friendId !== userId) throw new ForbiddenException('Not authorized to respond to this request');

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: accept ? 'accepted' : 'rejected' },
    });
  }

  async getFriends(userId: string): Promise<{ id: string; name: string; role: string }[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
        friend: { select: { id: true, name: true, role: true } },
      },
    });

    return friendships.map((f) => (f.userId === userId ? f.friend : f.user));
  }

  async getPendingRequests(userId: string): Promise<Friendship[]> {
    return this.prisma.friendship.findMany({
      where: { friendId: userId, status: 'pending' },
      include: {
        user: { select: { id: true, name: true } },
      },
    }) as unknown as Friendship[];
  }

  async getFeed(userId: string, tenantId: string): Promise<object[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
    });

    if (friendships.length === 0) return [];

    const friendIds = friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId,
    );

    const events = await this.prisma.socialFeedEvent.findMany({
      where: { actorId: { in: friendIds } },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return events
      .filter((e) => e.actor != null)
      .map((e) => ({
        id: e.id,
        actorId: e.actorId,
        actorName: e.actor.name,
        eventType: e.eventType,
        meta: e.meta as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
      }));
  }
}
