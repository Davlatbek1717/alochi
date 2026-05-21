import { Injectable, Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';

const LEADERBOARD_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class LeaderboardService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /**
   * Count lessons completed (home_completed = true) in the last 7 days
   * per student. Used as the "weekly" delta shown on leaderboard rows.
   */
  private async getWeeklyCompletedLessons(
    studentIds: string[],
  ): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const rows = await this.prisma.studentProgress.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        homeCompleted: true,
        completedAt: { gte: since },
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.studentId, r._count.id);
    }
    return map;
  }

  /**
   * Count total lessons where home_completed = true per student.
   * Returned as the primary ranking metric.
   */
  private async getTotalCompletedLessons(
    studentIds: string[],
  ): Promise<Map<string, number>> {
    if (studentIds.length === 0) return new Map();

    const rows = await this.prisma.studentProgress.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        homeCompleted: true,
      },
      _count: { id: true },
    });

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.studentId, r._count.id);
    }
    return map;
  }

  async getBranchLeaderboard(branchId: string | null | undefined) {
    if (!branchId) return [];

    const cacheKey = `leaderboard:branch:${branchId}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const students = await this.prisma.user.findMany({
      where: { branchId, role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        tenantId: true,
        groupId: true,
        studentStreak: { select: { currentStreak: true } },
      },
    });

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const [totalMap, weeklyMap] = await Promise.all([
      this.getTotalCompletedLessons(studentIds),
      this.getWeeklyCompletedLessons(studentIds),
    ]);

    // Sort by completedLessons desc, then streak desc
    const sorted = [...students].sort((a, b) => {
      const aLessons = totalMap.get(a.id) ?? 0;
      const bLessons = totalMap.get(b.id) ?? 0;
      if (bLessons !== aLessons) return bLessons - aLessons;
      const aStreak = a.studentStreak?.currentStreak ?? 0;
      const bStreak = b.studentStreak?.currentStreak ?? 0;
      return bStreak - aStreak;
    });

    // Fetch group names
    const groupIds = [
      ...new Set(sorted.map((s) => s.groupId).filter(Boolean) as string[]),
    ];
    const groupNameMap = new Map<string, string>();
    if (groupIds.length > 0) {
      const groups = await this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
      });
      for (const g of groups) groupNameMap.set(g.id, g.name);
    }

    const result = sorted.map((s, idx) => ({
      rank: idx + 1,
      id: s.id,
      name: s.name,
      completedLessons: totalMap.get(s.id) ?? 0,
      currentStreak: s.studentStreak?.currentStreak ?? 0,
      weeklyCompletedLessons: weeklyMap.get(s.id) ?? 0,
      groupName: s.groupId ? (groupNameMap.get(s.groupId) ?? null) : null,
    }));
    await this.cache.set(cacheKey, result, LEADERBOARD_TTL);
    return result;
  }

  async getGroupLeaderboard(groupId: string, tenantId: string) {
    const students = await this.prisma.user.findMany({
      where: { groupId, tenantId, role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        studentStreak: { select: { currentStreak: true } },
      },
    });

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const [totalMap, weeklyMap] = await Promise.all([
      this.getTotalCompletedLessons(studentIds),
      this.getWeeklyCompletedLessons(studentIds),
    ]);

    const sorted = [...students].sort((a, b) => {
      const aLessons = totalMap.get(a.id) ?? 0;
      const bLessons = totalMap.get(b.id) ?? 0;
      if (bLessons !== aLessons) return bLessons - aLessons;
      const aStreak = a.studentStreak?.currentStreak ?? 0;
      const bStreak = b.studentStreak?.currentStreak ?? 0;
      return bStreak - aStreak;
    });

    return sorted.map((s, idx) => ({
      rank: idx + 1,
      id: s.id,
      name: s.name,
      completedLessons: totalMap.get(s.id) ?? 0,
      currentStreak: s.studentStreak?.currentStreak ?? 0,
      weeklyCompletedLessons: weeklyMap.get(s.id) ?? 0,
      groupName: null,
    }));
  }

  async getNationalLeaderboard(period: 'weekly' | 'monthly', tenantId: string) {
    const since = new Date();
    if (period === 'weekly') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const rows = await this.prisma.studentProgress.groupBy({
      by: ['studentId'],
      where: {
        homeCompleted: true,
        completedAt: { gte: since },
        student: { tenantId, role: 'student' },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 100,
    });

    return rows.map((r, idx) => ({
      rank: idx + 1,
      alias: `O'quvchi #${r.studentId.slice(-4).toUpperCase()}`,
      completedLessons: r._count.id,
    }));
  }
}
