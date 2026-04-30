import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private feedEvent: FeedEventService,
    private analytics: AnalyticsService,
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

  async markAcademyCompleted(studentId: string, lessonId: string) {
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
}
