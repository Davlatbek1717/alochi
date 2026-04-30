import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupChallenge } from '@prisma/client';

@Injectable()
export class ChallengeService {
  constructor(private prisma: PrismaService) {}

  async create(
    tenantId: string,
    groupAId: string,
    groupBId: string,
    endDate: Date,
  ): Promise<GroupChallenge> {
    if (groupAId === groupBId) {
      throw new BadRequestException({
        code: 'CHALLENGE_SAME_GROUP',
        message: "Bir guruh o'ziga raqib bo'lolmaydi",
      });
    }

    // Same-branch validation: every student in either group must share a
    // single branchId. We use the group representative branch (mode of
    // student.branchId) as the canonical branch for the group.
    const [aBranch, bBranch] = await Promise.all([
      this.resolveGroupBranch(groupAId, tenantId),
      this.resolveGroupBranch(groupBId, tenantId),
    ]);
    if (!aBranch || !bBranch || aBranch !== bBranch) {
      throw new BadRequestException({
        code: 'CHALLENGE_CROSS_BRANCH',
        message: 'Challenge faqat bitta filial ichida ruxsat',
      });
    }

    // §7.1 — month-2-cap per group. Count active+completed challenges for
    // this group started in the current calendar month.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthCount = await this.prisma.groupChallenge.count({
      where: {
        tenantId,
        startDate: { gte: monthStart },
        OR: [
          { groupAId: { in: [groupAId, groupBId] } },
          { groupBId: { in: [groupAId, groupBId] } },
        ],
      },
    });
    if (monthCount >= 2) {
      throw new BadRequestException({
        code: 'CHALLENGE_LIMIT_EXCEEDED',
        message: "Bu oyga tegishli challenge limiti to'ldi (max 2)",
      });
    }

    // Single-active-cap — neither group can have an active challenge.
    const activeCount = await this.prisma.groupChallenge.count({
      where: {
        status: 'active',
        OR: [
          { groupAId: { in: [groupAId, groupBId] } },
          { groupBId: { in: [groupAId, groupBId] } },
        ],
      },
    });
    if (activeCount >= 1) {
      throw new BadRequestException({
        code: 'CHALLENGE_LIMIT_EXCEEDED',
        message: 'Faol challenge mavjud — yangi yaratib bolmaydi',
      });
    }

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

  /**
   * Pick the branch all students of `groupId` live in. Returns null if
   * the group is empty or spans multiple branches (which is invalid).
   */
  private async resolveGroupBranch(
    groupId: string,
    tenantId: string,
  ): Promise<string | null> {
    const students = await this.prisma.user.findMany({
      where: { groupId, role: 'student', tenantId },
      select: { branchId: true },
    });
    if (students.length === 0) return null;
    const branches = new Set(
      students.map((s) => s.branchId).filter((b): b is string => Boolean(b)),
    );
    if (branches.size !== 1) return null;
    return [...branches][0]!;
  }

  async getActiveForGroup(groupId: string): Promise<GroupChallenge | null> {
    return this.prisma.groupChallenge.findFirst({
      where: {
        status: 'active',
        OR: [{ groupAId: groupId }, { groupBId: groupId }],
      },
    });
  }

  async addXp(
    challengeId: string,
    groupId: string,
    xp: number,
  ): Promise<GroupChallenge> {
    const challenge = await this.prisma.groupChallenge.findUnique({
      where: { id: challengeId },
    });
    const isGroupA = challenge?.groupAId === groupId;

    return this.prisma.groupChallenge.update({
      where: { id: challengeId },
      data: isGroupA
        ? { groupAXp: { increment: xp } }
        : { groupBXp: { increment: xp } },
    });
  }

  async completeExpired(): Promise<void> {
    await this.prisma.groupChallenge.updateMany({
      where: { status: 'active', endDate: { lt: new Date() } },
      data: { status: 'completed' },
    });
  }
}
