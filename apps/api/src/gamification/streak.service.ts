import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class StreakService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

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

    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tenantId: true },
    });

    if (daysSinceLast === 1) {
      const newStreak = xp.currentStreak + 1;
      const updated = await this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          lastActivity: today,
          shieldCount:
            newStreak % 7 === 0 ? xp.shieldCount + 1 : xp.shieldCount,
        },
      });
      if (user) {
        this.analytics
          .logEvent({
            tenantId: user.tenantId,
            eventType: 'streak_updated',
            studentId,
            data: { newStreak, oldStreak: xp.currentStreak },
          })
          .catch(() => {});
      }
      return updated;
    }

    if (daysSinceLast === 2 && xp.shieldCount > 0) {
      const newStreak = xp.currentStreak + 1;
      const updated = await this.prisma.studentXp.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(xp.longestStreak, newStreak),
          shieldCount: xp.shieldCount - 1,
          lastActivity: today,
        },
      });
      if (user) {
        this.analytics
          .logEvent({
            tenantId: user.tenantId,
            eventType: 'streak_updated',
            studentId,
            data: { newStreak, oldStreak: xp.currentStreak },
          })
          .catch(() => {});
      }
      return updated;
    }

    return this.prisma.studentXp.update({
      where: { studentId },
      data: { currentStreak: 1, lastActivity: today },
    });
  }

  async getStudentStreak(
    studentId: string,
  ): Promise<{ streak: number; hasShield: boolean }> {
    const xp = await this.prisma.studentXp.findUnique({ where: { studentId } });
    if (!xp) return { streak: 0, hasShield: false };
    return { streak: xp.currentStreak, hasShield: xp.shieldCount > 0 };
  }
}
