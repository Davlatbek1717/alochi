import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  /** Compute weekly XP per student (sum of xpEvent.amount in last 7 days). */
  private async getWeeklyXpDelta(
    studentIds: string[],
    tenantId: string,
  ): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const rows = await this.prisma.xpEvent.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        createdAt: { gte: since },
        student: { tenantId },
      },
      _sum: { amount: true },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.studentId, r._sum.amount ?? 0);
    }
    return map;
  }

  async getBranchLeaderboard(branchId: string | null | undefined) {
    if (!branchId) return [];
    const rows = await this.prisma.studentXp.findMany({
      where: { student: { branchId, role: 'student', status: 'active' } },
      orderBy: [{ totalXp: 'desc' }, { currentStreak: 'desc' }],
      take: 50,
      include: {
        student: {
          select: { id: true, name: true, tenantId: true, groupId: true },
        },
      },
    });

    const studentIds = rows.map((r) => r.student.id);
    const tenantId = rows[0]?.student.tenantId ?? '';
    const weeklyMap = await this.getWeeklyXpDelta(studentIds, tenantId);

    // Fetch group names for groupId values present in this batch.
    const groupIds = [
      ...new Set(
        rows.map((r) => r.student.groupId).filter(Boolean) as string[],
      ),
    ];
    const groupNameMap = new Map<string, string>();
    if (groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      });
      for (const g of groups) groupNameMap.set(g.id, g.name);
    }

    return rows.map((r, idx) => ({
      rank: idx + 1,
      id: r.student.id,
      name: r.student.name,
      totalXp: r.totalXp,
      currentStreak: r.currentStreak,
      weeklyXp: weeklyMap.get(r.student.id) ?? 0,
      groupName: r.student.groupId
        ? (groupNameMap.get(r.student.groupId) ?? null)
        : null,
    }));
  }

  async getGroupLeaderboard(groupId: string, tenantId: string) {
    const rows = await this.prisma.studentXp.findMany({
      where: {
        student: { groupId, tenantId, role: 'student', status: 'active' },
      },
      orderBy: [{ totalXp: 'desc' }, { currentStreak: 'desc' }],
      take: 100,
      include: {
        student: { select: { id: true, name: true } },
      },
    });

    const studentIds = rows.map((r) => r.student.id);
    const weeklyMap = await this.getWeeklyXpDelta(studentIds, tenantId);

    return rows.map((r, idx) => ({
      rank: idx + 1,
      id: r.student.id,
      name: r.student.name,
      totalXp: r.totalXp,
      currentStreak: r.currentStreak,
      weeklyXp: weeklyMap.get(r.student.id) ?? 0,
      groupName: null,
    }));
  }

  async getNationalLeaderboard(period: 'weekly' | 'monthly', tenantId: string) {
    const since = new Date();
    if (period === 'weekly') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const tenantStudentIds = await this.prisma.user.findMany({
      where: { tenantId, role: 'student' },
      select: { id: true },
    });
    const studentIds = tenantStudentIds.map((u) => u.id);

    const rows = await this.prisma.xpEvent.groupBy({
      by: ['studentId'],
      where: { createdAt: { gte: since }, studentId: { in: studentIds } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 100,
    });

    return rows.map((r, idx) => ({
      rank: idx + 1,
      alias: `O'quvchi #${r.studentId.slice(-4).toUpperCase()}`,
      xp: r._sum.amount ?? 0,
    }));
  }
}
