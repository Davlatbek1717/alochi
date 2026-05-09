import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { FeedEventService } from '../social/feed-event.service';

const STREAK_MILESTONES = new Set([7, 30, 100]);

@Injectable()
export class StreakService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
    @Optional() private events?: EventEmitter2,
    @Optional()
    @Inject(forwardRef(() => FeedEventService))
    private feedEvent?: FeedEventService,
  ) {}

  private emitMilestoneIfReached(
    studentId: string,
    newStreak: number,
    tenantId?: string,
  ): void {
    if (newStreak === 30) {
      this.events?.emit('streak.milestone30', { studentId, tenantId });
    }
    if (STREAK_MILESTONES.has(newStreak) && tenantId) {
      this.feedEvent
        ?.emit(tenantId, studentId, 'streak_milestone', { days: newStreak })
        .catch(() => undefined);
    }
  }

  private emitBreak(studentId: string, oldStreak: number, tenantId?: string) {
    // Only emit a break event if the student had a meaningful streak (≥3)
    if (oldStreak >= 3 && tenantId) {
      this.feedEvent
        ?.emit(tenantId, studentId, 'streak_broken', { lostDays: oldStreak })
        .catch(() => undefined);
    }
  }

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const aDay = Math.floor(a.getTime() / msPerDay);
    const bDay = Math.floor(b.getTime() / msPerDay);
    return Math.abs(aDay - bDay);
  }

  async recordActivity(studentId: string) {
    const today = new Date();
    const streak = await this.prisma.studentStreak.findUnique({
      where: { studentId },
    });

    if (!streak) {
      return this.prisma.studentStreak.upsert({
        where: { studentId },
        create: { studentId, currentStreak: 1, lastActivity: today },
        update: { currentStreak: 1, lastActivity: today },
      });
    }

    if (!streak.lastActivity) {
      return this.prisma.studentStreak.update({
        where: { studentId },
        data: { currentStreak: 1, lastActivity: today },
      });
    }

    const daysSinceLast = this.daysBetween(today, streak.lastActivity);

    if (daysSinceLast === 0) {
      return streak;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { tenantId: true },
    });

    if (daysSinceLast === 1) {
      const newStreak = streak.currentStreak + 1;
      const updated = await this.prisma.studentStreak.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
          lastActivity: today,
          shieldCount:
            newStreak % 7 === 0 ? streak.shieldCount + 1 : streak.shieldCount,
        },
      });
      if (user) {
        this.analytics
          .logEvent({
            tenantId: user.tenantId,
            eventType: 'streak_updated',
            studentId,
            data: { newStreak, oldStreak: streak.currentStreak },
          })
          .catch(() => {});
      }
      this.emitMilestoneIfReached(studentId, newStreak, user?.tenantId);
      return updated;
    }

    if (daysSinceLast === 2 && streak.shieldCount > 0) {
      const newStreak = streak.currentStreak + 1;
      const updated = await this.prisma.studentStreak.update({
        where: { studentId },
        data: {
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
          shieldCount: streak.shieldCount - 1,
          lastActivity: today,
        },
      });
      if (user) {
        this.analytics
          .logEvent({
            tenantId: user.tenantId,
            eventType: 'streak_updated',
            studentId,
            data: { newStreak, oldStreak: streak.currentStreak },
          })
          .catch(() => {});
      }
      this.emitMilestoneIfReached(studentId, newStreak, user?.tenantId);
      return updated;
    }

    // Streak broken — gap > 1 day (or > 2 with no shield).
    this.emitBreak(studentId, streak.currentStreak, user?.tenantId);
    return this.prisma.studentStreak.update({
      where: { studentId },
      data: { currentStreak: 1, lastActivity: today },
    });
  }

  async getStudentStreak(
    studentId: string,
  ): Promise<{ streak: number; hasShield: boolean }> {
    const row = await this.prisma.studentStreak.findUnique({
      where: { studentId },
    });
    if (!row) return { streak: 0, hasShield: false };
    return { streak: row.currentStreak, hasShield: row.shieldCount > 0 };
  }
}
