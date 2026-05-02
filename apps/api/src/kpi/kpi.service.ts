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

/**
 * Stable `reason` codes for auto-calculated KPI awards.
 * Used both for emission and for idempotency lookups (one award per
 * user/reason/period).
 */
export const KPI_REASONS = {
  AUTO_MENTOR_DAILY: 'auto_mentor_daily',
  CRITICAL_RED_TO_YELLOW: 'critical_red_to_yellow',
  CRITICAL_YELLOW_TO_GREEN: 'critical_yellow_to_green',
  FILADMIN_MONTHLY_BONUS: 'filadmin_monthly_bonus',
  FILADMIN_MONTHLY_PENALTY: 'filadmin_monthly_penalty',
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

  /**
   * Branch-wide KPI award history. Joins on user.branchId so awards
   * follow the recipient's current branch (cheap, indexed lookup).
   */
  async getBranchHistory(
    branchId: string,
    opts: { from?: Date; to?: Date; limit?: number } = {},
  ) {
    const where: {
      user: { branchId: string };
      date?: { gte?: Date; lte?: Date };
    } = { user: { branchId } };
    if (opts.from || opts.to) {
      where.date = {};
      if (opts.from) where.date.gte = opts.from;
      if (opts.to) where.date.lte = opts.to;
    }
    return this.prisma.kpiScore.findMany({
      where,
      orderBy: { date: 'desc' },
      take: opts.limit ?? 100,
      include: { user: { select: { id: true, name: true, role: true } } },
    });
  }

  /**
   * §8.1 — Daily KPI breakdown for a mentor. Each row caps at +5 ball
   * when the spec target is hit; partial completion scales linearly.
   *
   *   Darsda o'quvchi soni      target: 20 ta        +5
   *   Dars davomiyligi          target: ≥15 daqiqa   +5 (binary)
   *   Balllar qo'yilishi        target: 20 ta        +5
   *   Vaqtida habar berish      target: ≥1 qizil     +5 (binary)
   *
   * Max per day = 20. The previous version multiplied studentsTaught
   * × 5 (capping at 100) which over-rewarded by a factor of 4 vs.
   * the spec table.
   */
  computeMentorDaily(input: {
    studentsTaught: number;
    durationMinutes: number;
    scoresGiven: number;
    redNotified: number;
  }): { totalScore: number; cappedStudents: number } {
    const STUDENT_TARGET = 20;
    const SCORES_TARGET = 20;
    const cappedStudents = Math.min(
      STUDENT_TARGET,
      Math.max(0, input.studentsTaught),
    );
    const cappedScores = Math.min(
      SCORES_TARGET,
      Math.max(0, input.scoresGiven),
    );

    // Linear scale to KPI_POINTS.MENTOR_LESSON_STUDENTS at the target.
    // Round so we don't store fractional ball.
    const studentScore = Math.round(
      (cappedStudents / STUDENT_TARGET) * KPI_POINTS.MENTOR_LESSON_STUDENTS,
    );
    const durationScore =
      input.durationMinutes >= 15 ? KPI_POINTS.MENTOR_LESSON_DURATION : 0;
    const scoresScore = Math.round(
      (cappedScores / SCORES_TARGET) * KPI_POINTS.MENTOR_SCORES_GIVEN,
    );
    // Spec: "Vaqtida habar berish | Qizil o'quvchi | +5" — binary,
    // not per-warning, so spamming warnings doesn't farm KPI.
    const redScore = input.redNotified > 0 ? KPI_POINTS.MENTOR_RED_NOTIFIED : 0;

    return {
      totalScore: studentScore + durationScore + scoresScore + redScore,
      cappedStudents,
    };
  }

  /**
   * Idempotency check for auto-calc cron jobs: returns true if a KPI
   * award already exists for the (userId, reason) pair within the given
   * date range. Cron handlers use this to avoid double-awarding when
   * a job is retried (or when 28-31th cron fires multiple non-last days).
   */
  async hasAwardInRange(
    userId: string,
    reason: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<boolean> {
    const found = await this.prisma.kpiScore.findFirst({
      where: {
        userId,
        reason,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { id: true },
    });
    return !!found;
  }
}
