import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AwardKpiDto {
  tenantId: string;
  userId: string;
  score: number;
  reason: string;
  taskId?: string;
  delegationId?: string;
}

export const KPI_POINTS = {
  MENTOR_LESSON_STUDENTS: 5,
  MENTOR_LESSON_DURATION: 5,
  MENTOR_SCORES_GIVEN: 5,
  MENTOR_RED_NOTIFIED: 5,
  MANAGER_RED_TO_YELLOW: 10,
  MANAGER_YELLOW_TO_GREEN: 15,
  MANAGER_ONE_ON_ONE: 5,
} as const;

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  async award(dto: AwardKpiDto) {
    return this.prisma.kpiScore.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        date: new Date(),
        score: dto.score,
        reason: dto.reason,
        taskId: dto.taskId,
        delegationId: dto.delegationId,
      },
    });
  }

  async getDailyTotal(userId: string, date: Date): Promise<number> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const agg = await this.prisma.kpiScore.aggregate({
      where: { userId, date: { gte: start, lte: end } },
      _sum: { score: true },
    });

    return agg._sum.score ?? 0;
  }

  async getMonthlyTotal(
    userId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const agg = await this.prisma.kpiScore.aggregate({
      where: { userId, date: { gte: start, lte: end } },
      _sum: { score: true },
    });

    return agg._sum.score ?? 0;
  }

  async getHistory(userId: string, limit = 30) {
    return this.prisma.kpiScore.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }
}
