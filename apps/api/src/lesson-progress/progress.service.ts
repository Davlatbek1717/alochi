import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CityService } from '../gamification/city.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private feedEvent: FeedEventService,
    private analytics: AnalyticsService,
    @Optional() private city?: CityService,
  ) {}

  private async getEffectiveN(
    studentId: string,
    lessonId: string,
    tenantId: string,
  ): Promise<number> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, tenantId },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    const override = await this.prisma.studentLessonConfig.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    if (override)
      return Math.min(override.nRepetitionsOverride, lesson.maxNOverride);
    return lesson.nRepetitions;
  }

  /**
   * 25.J.1: Reject completion when video watched <90% of duration.
   * Throws BadRequestException with code VIDEO_WATCH_INCOMPLETE.
   */
  assertVideoWatched(watched: number, duration: number) {
    if (!duration || duration <= 0) return;
    const ratio = watched / duration;
    if (ratio < 0.9) {
      throw new BadRequestException({
        code: 'VIDEO_WATCH_INCOMPLETE',
        message: 'Videoning kamida 90% qismini tomosha qilish kerak',
        details: { watched, duration, ratio: Math.round(ratio * 100) / 100 },
      });
    }
  }

  async completeSession(studentId: string, lessonId: string, tenantId: string) {
    const effectiveN = await this.getEffectiveN(studentId, lessonId, tenantId);

    const current = await this.prisma.studentProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });

    const newCount = (current?.sessionCount ?? 0) + 1;
    const homeCompleted = newCount >= effectiveN;

    const progress = await this.prisma.studentProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
      update: {
        sessionCount: newCount,
        homeCompleted,
        lastActivityAt: new Date(),
        ...(homeCompleted ? { completedAt: new Date() } : {}),
      },
    });

    this.analytics
      .logEvent({
        tenantId,
        eventType: homeCompleted ? 'lesson_completed' : 'lesson_failed',
        studentId,
        data: { lessonId, sessionCount: newCount },
      })
      .catch(() => {});
    return progress;
  }

  /**
   * Start an academy session for a student. Creates a StudentProgress row
   * (or updates lastActivityAt if one already exists). Returns the row.
   */
  async startAcademySession(studentId: string, lessonId: string) {
    if (!lessonId) {
      throw new NotFoundException('lessonId majburiy');
    }
    return this.prisma.studentProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: {
        studentId,
        lessonId,
        sessionCount: 0,
        homeCompleted: false,
        lastActivityAt: new Date(),
      },
      update: {
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 25.F.2: Compute lesson duration on end. KPI flag is `true` when the
   * mentor lesson lasted < 15 minutes — caller may use it to dock KPI.
   */
  async endLesson(
    studentId: string,
    lessonId: string,
    startedAt: Date | string,
    endedAt: Date | string = new Date(),
  ): Promise<{ durationMinutes: number; minimumMet: boolean }> {
    const start =
      typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
    const end = typeof endedAt === 'string' ? new Date(endedAt) : endedAt;
    const ms = Math.max(0, end.getTime() - start.getTime());
    const durationMinutes = Math.round(ms / 60000);
    const minimumMet = durationMinutes >= 15;

    await this.prisma.studentProgress
      .updateMany({
        where: { studentId, lessonId },
        data: { lastActivityAt: end },
      })
      .catch(() => undefined);

    return { durationMinutes, minimumMet };
  }

  async markAcademyCompleted(studentId: string, lessonId: string) {
    // Capture pre-update count to detect a city-level boundary crossing.
    const oldCount = await this.prisma.studentProgress.count({
      where: { studentId, academyCompleted: true },
    });

    const result = await this.prisma.studentProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { academyCompleted: true, completedAt: new Date() },
    });

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, tenantId: true },
    });

    if (lesson) {
      this.feedEvent
        .emit(lesson.tenantId, studentId, 'lesson_done', {
          lessonId,
          lessonTitle: lesson.title,
        })
        .catch(() => {});

      // City level-up feed event (if a threshold was crossed).
      if (this.city) {
        await this.city
          .checkCityLevelUp(studentId, lesson.tenantId, oldCount, oldCount + 1)
          .catch(() => undefined);
      }
    }

    return result;
  }

  async getStudentProgress(studentId: string) {
    return this.prisma.studentProgress.findMany({
      where: { studentId },
      include: {
        lesson: { select: { id: true, title: true, orderNumber: true } },
      },
      orderBy: { lesson: { orderNumber: 'asc' } },
    });
  }

  /**
   * Compact progress roll-up for staff UIs (mentor student-detail). Returns
   * counts only — no per-lesson rows — so it stays cheap even when a
   * student has dozens of progress entries.
   */
  async getSummary(studentId: string) {
    const [completed, inProgress] = await Promise.all([
      this.prisma.studentProgress.count({
        where: { studentId, academyCompleted: true },
      }),
      this.prisma.studentProgress.count({
        where: { studentId, academyCompleted: false },
      }),
    ]);
    return { studentId, completed, inProgress };
  }
}
