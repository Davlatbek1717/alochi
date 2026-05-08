import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CityService } from '../gamification/city.service';
import { XpService } from '../gamification/xp.service';
import { StreakService } from '../gamification/streak.service';
import { QuestService } from '../gamification/quest.service';
import { CertificatesService } from '../gamification/certificates.service';
import { StatusService } from '../student-status/status.service';
import type { StatusColor } from '../student-status/status.types';

/**
 * Accuracy → englishStatus mapping (Variant B — no AI dependency).
 * Mirrors AiService.scoreToStatusColor so the two paths agree once the
 * AI evaluate flow is also wired in.
 */
function accuracyToStatusColor(accuracy: number): StatusColor {
  if (accuracy >= 80) return 'yashil';
  if (accuracy >= 50) return 'sariq';
  return 'qizil';
}

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private feedEvent: FeedEventService,
    private analytics: AnalyticsService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @Optional() private city?: CityService,
    @Optional() private xp?: XpService,
    @Optional() private streak?: StreakService,
    @Optional() private quest?: QuestService,
    @Optional() private status?: StatusService,
    @Optional()
    @Inject(forwardRef(() => CertificatesService))
    private certificates?: CertificatesService,
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

  async completeSession(
    studentId: string,
    lessonId: string,
    tenantId: string,
    /** Per-session accuracy 0-100. When provided, drives the auto-status
     *  flow (Variant B): the value is mapped to yashil/sariq/qizil and
     *  written to today's StudentStatus row via StatusService. Optional
     *  so older clients (and tests that don't care about status) keep
     *  working unchanged. */
    accuracy?: number,
    /** Caller's role — gamification side-effects (XP, streak, quest,
     *  city) only run for `student`. Testers run lessons without
     *  accumulating student stats. */
    callerRole?: string,
  ) {
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

    // Invalidate the marketing cache so the landing page's student list and
    // stats reflect the updated session count within seconds instead of
    // waiting for the full TTL. We don't use pattern-delete because
    // cache-manager v5 stores don't expose that uniformly across backends.
    for (const key of ['mc:stats', 'mc:students:50:0', 'mc:students:100:0']) {
      this.cache.del(key).catch(() => undefined);
    }

    // Gamification side-effects only apply when the caller is a student.
    // Testers run lessons to validate content and must not accumulate
    // student XP, streaks, quests, or city buildings.
    const isStudent = !callerRole || callerRole === 'student';

    // Reward the student for completing this session. All four side-effects
    // are best-effort: a failure here must not roll back the progress row
    // the user just earned.
    if (isStudent && this.xp) {
      this.xp
        .award(studentId, 'LESSON_COMPLETE', {
          lessonId,
          sessionCount: newCount,
          homeCompleted,
        })
        .catch(() => {});
    }
    if (isStudent && this.streak) {
      this.streak.recordActivity(studentId).catch(() => {});
    }
    if (isStudent && this.quest) {
      this.quest.updateProgress(studentId, 'lesson_complete').catch(() => {});
      // 25.A.4: any session completion implicitly proves the video was
      // watched, so credit the daily "watch_video" quest too.
      this.quest.updateProgress(studentId, 'watch_video').catch(() => {});
    }

    // Variant B auto-status: when the client reports a per-session accuracy
    // (0-100), map it to yashil/sariq/qizil and persist to today's
    // StudentStatus row. Status writes are best-effort — a failure here
    // must not roll back the lesson the student just earned. Mentor still
    // sees and can override the colour from the group page.
    if (
      isStudent &&
      this.status &&
      typeof accuracy === 'number' &&
      Number.isFinite(accuracy)
    ) {
      const clamped = Math.max(0, Math.min(100, Math.round(accuracy)));
      const color = accuracyToStatusColor(clamped);
      this.status
        .setEnglishStatus(studentId, color, {
          source: 'lesson_accuracy',
          lessonId,
          score: clamped,
        })
        .catch(() => {});
    }

    // When the student finishes the home portion (sessionCount === N) emit a
    // social feed event so friends see the completion. Academy completion has
    // its own emit in markAcademyCompleted().
    if (isStudent && homeCompleted) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { title: true, tenantId: true },
      });
      if (lesson) {
        this.feedEvent
          .emit(lesson.tenantId, studentId, 'lesson_done', {
            lessonId,
            lessonTitle: lesson.title,
            stage: 'home',
          })
          .catch(() => {});

        // Per spec §17.1: each completed lesson adds one building to the
        // student's Virtual City. Idempotent on (studentId, lessonId) so
        // repeated completion attempts don't duplicate. Best-effort —
        // a city failure must not roll back the lesson the student earned.
        if (this.city) {
          this.city
            .addBuildingForLesson(studentId, lesson.tenantId, lessonId)
            .catch(() => {});
        }
      }
    }
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
    const result = await this.prisma.studentProgress.update({
      where: { studentId_lessonId: { studentId, lessonId } },
      data: { academyCompleted: true, completedAt: new Date() },
    });

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { title: true, tenantId: true },
    });

    // Invalidate the marketing cache so the landing page's student list and
    // stats reflect the newly completed academy lesson within seconds. We
    // don't use pattern-delete because cache-manager v5 stores don't expose
    // that uniformly across backends.
    for (const key of ['mc:stats', 'mc:students:50:0', 'mc:students:100:0']) {
      this.cache.del(key).catch(() => undefined);
    }

    if (lesson) {
      this.feedEvent
        .emit(lesson.tenantId, studentId, 'lesson_done', {
          lessonId,
          lessonTitle: lesson.title,
        })
        .catch(() => {});

      // City: ensure a building exists for this lesson once the mentor
      // has approved academy completion. Idempotent — if the home-completion
      // path already added one, this is a no-op. If the home-completion
      // path was skipped (mentor-only path) this guarantees the student
      // still gets credit. Best-effort.
      if (this.city) {
        await this.city
          .addBuildingForLesson(studentId, lesson.tenantId, lessonId)
          .catch(() => undefined);
      }

      // Auto-award any certificate the student has now earned. Best-effort —
      // a failure here must not roll back the academy-completion the mentor
      // just recorded.
      this.certificates
        ?.checkAndAward(studentId, lesson.tenantId)
        .catch(() => undefined);
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
