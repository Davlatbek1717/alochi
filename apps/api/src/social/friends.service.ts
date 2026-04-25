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

  async getFeed(userId: string): Promise<{
    userId: string;
    userName: string;
    lessonId: string;
    lessonTitle: string;
    sessionCount: number;
    homeCompleted: boolean;
    updatedAt: string;
  }[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ userId }, { friendId: userId }],
      },
      select: { userId: true, friendId: true },
    });

    if (friendships.length === 0) return [];

    const friendIds = friendships.map((f) =>
      f.userId === userId ? f.friendId : f.userId,
    );

    const progressRecords = await this.prisma.studentProgress.findMany({
      where: {
        studentId: { in: friendIds },
        lastActivityAt: { not: null },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 20,
      include: {
        student: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
      },
    });

    return progressRecords.map((p) => ({
      userId: p.student.id,
      userName: p.student.name,
      lessonId: p.lesson.id,
      lessonTitle: p.lesson.title,
      sessionCount: p.sessionCount,
      homeCompleted: p.homeCompleted,
      updatedAt: p.lastActivityAt!.toISOString(),
    }));
  }
}
