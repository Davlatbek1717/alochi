import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private clickhouse: ClickHouseService,
  ) {}

  async getLessonStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        lesson_id: string;
        pass_rate: number;
        total_students: number;
        passed: number;
        avg_sessions: number;
        feedback_avg: number | null;
      }>
    >(
      `SELECT lesson_id, pass_rate, total_students, passed, avg_sessions, feedback_avg
       FROM lesson_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      lessonId: r.lesson_id,
      passRate: Number(r.pass_rate),
      totalStudents: Number(r.total_students),
      passed: Number(r.passed),
      avgSessions: Number(r.avg_sessions),
      feedbackAvg: r.feedback_avg != null ? Number(r.feedback_avg) : null,
    }));
  }

  async getBranchStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        branch_id: string;
        active_students: number;
        avg_streak: number;
        avg_xp: number;
      }>
    >(
      `SELECT branch_id, active_students, avg_streak, avg_xp
       FROM branch_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      branchId: r.branch_id,
      activeStudents: Number(r.active_students),
      avgStreak: Number(r.avg_streak),
      avgXp: Number(r.avg_xp),
    }));
  }

  async getStudentActivity(tenantId: string, period: 'weekly' | 'monthly') {
    const days = period === 'weekly' ? 7 : 30;
    const rows = await this.clickhouse.query<{ day: string; count: string }>(
      `SELECT toDate(created_at)::String AS day, count(DISTINCT student_id)::String AS count
       FROM events
       WHERE tenant_id = {tenantId:UUID}
         AND event_type = 'lesson_completed'
         AND created_at >= now() - INTERVAL ${days} DAY
       GROUP BY day ORDER BY day`,
      { tenantId },
    );
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  async logEvent(params: {
    tenantId: string;
    eventType: string;
    studentId?: string;
    branchId?: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    // 1. PostgreSQL — must succeed (audit + reliability buffer)
    const event = await this.prisma.analyticsEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        studentId: params.studentId,
        branchId: params.branchId,
        data: (params.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    // 2. ClickHouse — fire-and-forget; on success mark syncedAt, on failure leave null for retry
    if (!this.clickhouse.isReady()) {
      this.logger.debug(
        `ClickHouse not ready — event ${event.id} queued for retry`,
      );
      return;
    }

    const data = params.data ?? {};
    const lessonId = (data as { lessonId?: string }).lessonId ?? null;
    const sessionCount = (data as { sessionCount?: number }).sessionCount ?? 0;
    const isPresent = (data as { isPresent?: boolean }).isPresent;
    const isLate = (data as { isLate?: boolean }).isLate;
    const newStreak = (data as { newStreak?: number }).newStreak;

    this.clickhouse
      .insertEvent({
        event_id: event.id,
        tenant_id: event.tenantId,
        event_type: event.eventType,
        student_id: event.studentId,
        branch_id: event.branchId,
        lesson_id: lessonId,
        session_count: sessionCount,
        is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
        is_late: isLate === undefined ? null : isLate ? 1 : 0,
        new_streak: newStreak ?? null,
        data: JSON.stringify(data),
        created_at: event.createdAt.toISOString(),
      })
      .then(() =>
        this.prisma.analyticsEvent
          .update({ where: { id: event.id }, data: { syncedAt: new Date() } })
          .catch((e) =>
            this.logger.warn(`syncedAt update failed: ${(e as Error).message}`),
          ),
      )
      .catch((e) => {
        this.logger.warn(
          `ClickHouse insert failed for event ${event.id}: ${(e as Error).message}`,
        );
      });
  }
}
