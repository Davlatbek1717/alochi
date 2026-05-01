import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const XP_AMOUNTS = {
  LESSON_COMPLETE: 100,
  STREAK_DAILY: 20,
  PERFECT_TEST: 50,
  FAST_SUBMIT: 30,
  DAILY_QUEST: 75,
  DUEL_WIN: 150,
  DUEL_PARTICIPATE: 30,
  DUEL_NO_SHOW: 50,
  // Spec §7.1 — group challenge outcomes (awarded by cron on expiry).
  CHALLENGE_WINNER: 500,
  CHALLENGE_CONSOLATION: 100,
} as const;

type XpReasonKey = keyof typeof XP_AMOUNTS;
type XpReason = XpReasonKey | Lowercase<XpReasonKey>;

const LEVELS = [
  { min: 0, name: 'Novice' },
  { min: 200, name: 'Learner' },
  { min: 2000, name: 'Scholar' },
  { min: 5000, name: 'Expert' },
  { min: 10000, name: 'Master' },
] as const;

@Injectable()
export class XpService {
  constructor(private prisma: PrismaService) {}

  getLevel(totalXp: number): string {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVELS[i].min) return LEVELS[i].name;
    }
    return 'Novice';
  }

  getNextLevelXp(totalXp: number): number {
    for (const level of LEVELS) {
      if (totalXp < level.min) return level.min;
    }
    return Infinity;
  }

  async award(studentId: string, reason: XpReason, metadata?: object) {
    const key = reason.toUpperCase() as XpReasonKey;
    const amount = XP_AMOUNTS[key];

    await this.prisma.xpEvent.create({
      data: { studentId, amount, reason: key, metadata },
    });

    return this.prisma.studentXp.upsert({
      where: { studentId },
      create: { studentId, totalXp: amount },
      update: { totalXp: { increment: amount } },
    });
  }

  /** Default per-day XP target shown by the dashboard ring. Future work can
   * promote this to a per-tenant or per-student setting. */
  static readonly DEFAULT_DAILY_GOAL = 30;

  /**
   * Sum of XP awarded today (client-local 24h window starting at midnight UTC
   * of the server). Returns 0 when the student has no events today. The
   * reducer is small enough that we don't shard further by reason — if that
   * becomes a hotspot we can add an `xp_events_daily` materialized view.
   */
  async getTodayXp(studentId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const events = await this.prisma.xpEvent.findMany({
      where: { studentId, createdAt: { gte: start } },
      select: { amount: true },
    });
    return events.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  }

  async getStudentXp(studentId: string) {
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });
    const todayXp = await this.getTodayXp(studentId);

    if (!xp)
      return {
        totalXp: 0,
        level: 'Novice',
        currentStreak: 0,
        nextLevelXp: this.getNextLevelXp(0),
        todayXp,
        dailyGoal: XpService.DEFAULT_DAILY_GOAL,
      };

    return {
      ...xp,
      level: this.getLevel(xp.totalXp),
      nextLevelXp: this.getNextLevelXp(xp.totalXp),
      todayXp,
      dailyGoal: XpService.DEFAULT_DAILY_GOAL,
    };
  }
}
