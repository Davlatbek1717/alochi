import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const XP_AMOUNTS = {
  LESSON_COMPLETE: 100,
  STREAK_DAILY: 20,
  PERFECT_TEST: 50,
  FAST_SUBMIT: 30,
  DAILY_QUEST: 75,
  DUEL_WIN: 50,
  DUEL_PARTICIPATE: 10,
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

  async getStudentXp(studentId: string) {
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });
    if (!xp) return { totalXp: 0, level: 'Novice', currentStreak: 0 };

    return {
      ...xp,
      level: this.getLevel(xp.totalXp),
      nextLevelXp: this.getNextLevelXp(xp.totalXp),
    };
  }
}
