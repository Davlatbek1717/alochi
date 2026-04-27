import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getBranchLeaderboard(branchId: string) {
    const rows = await this.prisma.studentXp.findMany({
      where: { student: { branchId, role: 'student', status: 'active' } },
      orderBy: { totalXp: 'desc' },
      take: 50,
      include: { student: { select: { id: true, name: true } } },
    });

    return rows.map((r, idx) => ({
      rank: idx + 1,
      id: r.student.id,
      name: r.student.name,
      totalXp: r.totalXp,
      streak: r.currentStreak,
    }));
  }

  async getNationalLeaderboard(period: 'weekly' | 'monthly') {
    const since = new Date();
    if (period === 'weekly') since.setDate(since.getDate() - 7);
    else since.setMonth(since.getMonth() - 1);

    const rows = await this.prisma.xpEvent.groupBy({
      by: ['studentId'],
      where: { createdAt: { gte: since } },
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
