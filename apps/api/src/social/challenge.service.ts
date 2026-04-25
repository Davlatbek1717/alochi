import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupChallenge } from '@prisma/client';

@Injectable()
export class ChallengeService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, groupAId: string, groupBId: string, endDate: Date): Promise<GroupChallenge> {
    return this.prisma.groupChallenge.create({
      data: {
        tenantId,
        groupAId,
        groupBId,
        startDate: new Date(),
        endDate,
        status: 'active',
      },
    });
  }

  async getActiveForGroup(groupId: string): Promise<GroupChallenge | null> {
    return this.prisma.groupChallenge.findFirst({
      where: {
        status: 'active',
        OR: [{ groupAId: groupId }, { groupBId: groupId }],
      },
    });
  }

  async addXp(challengeId: string, groupId: string, xp: number): Promise<GroupChallenge> {
    const challenge = await this.prisma.groupChallenge.findUnique({ where: { id: challengeId } });
    const isGroupA = challenge?.groupAId === groupId;

    return this.prisma.groupChallenge.update({
      where: { id: challengeId },
      data: isGroupA ? { groupAXp: { increment: xp } } : { groupBXp: { increment: xp } },
    });
  }

  async completeExpired(): Promise<void> {
    await this.prisma.groupChallenge.updateMany({
      where: { status: 'active', endDate: { lt: new Date() } },
      data: { status: 'completed' },
    });
  }
}
