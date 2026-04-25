import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreakService {
  constructor(private prisma: PrismaService) {}

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const aDay = Math.floor(a.getTime() / msPerDay);
    const bDay = Math.floor(b.getTime() / msPerDay);
    return Math.abs(aDay - bDay);
  }

  async recordActivity(studentId: string) {
    const today = new Date();
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });

    if (!xp) {
      return this.prisma.studentXp.upsert({
        where: { studentId },
        create: { studentId, currentStreak: 1, lastActivity: today },
        update: { currentStreak: 1, lastActivity: today },
      });
    }

    if (!xp.lastActivity) {
      return this.prisma.studentXp.update({
        where: { studentId },
        data: { currentStreak: 1, lastActivity: today },
      });
    }

    const daysSinceLast = this.daysBetween(today, xp.lastActivity);

    if (daysSinceLast === 0) {
      return xp;
    }

    if (daysSinceLast === 1) {
      const newStreak = xp.currentStreak + 1;
      return this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          lastActivity: today,
          shieldCount: newStreak % 7 === 0 ? xp.shieldCount + 1 : xp.shieldCount,
        },
      });
    }

    if (daysSinceLast === 2 && xp.shieldCount > 0) {
      const newStreak = xp.currentStreak + 1;
      return this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          shieldCount: xp.shieldCount - 1,
          lastActivity: today,
        },
      });
    }

    return this.prisma.studentXp.update({
      where: { studentId },
      data: { currentStreak: 1, lastActivity: today },
    });
  }
}
