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

  async getCohortRetention(
    tenantId: string,
    weeks = 8,
  ): Promise<
    Array<{
      cohortWeek: string;
      size: number;
      retention: Record<string, number>;
    }>
  > {
    type Row = {
      cohort_week: string;
      week_offset: string;
      cohort_size: string;
      active: string;
    };
    // Reads from the `cohort_weekly` view (see migration 003) which joins
    // events to the `cohort_first_event_mv` AggregatingMergeTree. Cheaper
    // than the previous ad-hoc CTE/window approach; same response shape.
    // cohort_size is taken from the row where return_week == cohort_week
    // (week 0 — every member of the cohort is active by definition).
    const rows = await this.clickhouse.query<Row>(
      `SELECT
         toString(cw.cohort_week) AS cohort_week,
         toString(dateDiff('week', cw.cohort_week, cw.return_week)) AS week_offset,
         toString(any(size.active_users) OVER (PARTITION BY cw.cohort_week)) AS cohort_size,
         toString(cw.active_users) AS active
       FROM cohort_weekly AS cw
       LEFT JOIN (
         SELECT tenant_id, cohort_week, active_users
         FROM cohort_weekly
         WHERE tenant_id = {tenantId:UUID} AND cohort_week = return_week
       ) AS size
         ON size.tenant_id = cw.tenant_id AND size.cohort_week = cw.cohort_week
       WHERE cw.tenant_id = {tenantId:UUID}
         AND cw.cohort_week >= today() - INTERVAL {weeks:UInt16} WEEK
         AND dateDiff('week', cw.cohort_week, cw.return_week) BETWEEN 0 AND {weeks:UInt16}
       ORDER BY cw.cohort_week DESC, cw.return_week ASC`,
      { tenantId, weeks },
    );

    const grouped = new Map<
      string,
      { size: number; retention: Record<string, number> }
    >();
    for (const r of rows) {
      const cohortWeek = r.cohort_week;
      const offset = Number(r.week_offset);
      const size = Number(r.cohort_size);
      const active = Number(r.active);
      const pct = size === 0 ? 0 : Math.round((active * 100) / size);
      if (!grouped.has(cohortWeek)) {
        grouped.set(cohortWeek, { size, retention: {} });
      }
      const entry = grouped.get(cohortWeek)!;
      entry.size = size;
      if (offset >= 0) entry.retention[`week${offset}`] = pct;
    }
    return Array.from(grouped.entries()).map(([cohortWeek, v]) => ({
      cohortWeek,
      size: v.size,
      retention: v.retention,
    }));
  }

  async getFunnel(
    tenantId: string,
    lessonId: string,
  ): Promise<Array<{ step: string; count: number }>> {
    const rows = await this.clickhouse.query<{
      event_type: string;
      cnt: string;
    }>(
      `SELECT event_type, toString(uniqExact(student_id)) AS cnt
       FROM events
       WHERE tenant_id = {tenantId:UUID}
         AND lesson_id = {lessonId:UUID}
         AND event_type IN ('lesson_session', 'lesson_failed', 'lesson_completed')
       GROUP BY event_type`,
      { tenantId, lessonId },
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.event_type] = Number(r.cnt);

    return [
      { step: 'Sessiya boshlangan', count: counts['lesson_session'] ?? 0 },
      {
        step: 'Test topshirgan',
        count: (counts['lesson_session'] ?? 0) - (counts['lesson_failed'] ?? 0),
      },
      {
        step: 'Muvaffaqiyatli yakunlangan',
        count: counts['lesson_completed'] ?? 0,
      },
    ];
  }

  async getLifecycle(
    tenantId: string,
  ): Promise<{ dau: number; wau: number; mau: number; stickiness: number }> {
    const rows = await this.clickhouse.query<{
      dau: string;
      wau: string;
      mau: string;
    }>(
      `SELECT
         toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 1 DAY)) AS dau,
         toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 7 DAY)) AS wau,
         toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 30 DAY)) AS mau
       FROM events
       WHERE tenant_id = {tenantId:UUID} AND student_id IS NOT NULL`,
      { tenantId },
    );
    if (rows.length === 0) return { dau: 0, wau: 0, mau: 0, stickiness: 0 };
    const dau = Number(rows[0].dau);
    const wau = Number(rows[0].wau);
    const mau = Number(rows[0].mau);
    const stickiness = mau === 0 ? 0 : Math.round((dau * 100) / mau) / 100;
    return { dau, wau, mau, stickiness };
  }

  async getTopFailures(
    tenantId: string,
    limit = 10,
  ): Promise<
    Array<{
      lessonId: string;
      failedCount: number;
      completedCount: number;
      failureRate: number;
    }>
  > {
    const rows = await this.clickhouse.query<{
      lesson_id: string;
      failed: string;
      completed: string;
    }>(
      `SELECT
         toString(lesson_id) AS lesson_id,
         toString(sum(failed_count)) AS failed,
         toString(sum(completed_count)) AS completed
       FROM lesson_failures
       WHERE tenant_id = {tenantId:UUID}
       GROUP BY lesson_id
       HAVING failed > 0
       ORDER BY failed DESC
       LIMIT {limit:UInt16}`,
      { tenantId, limit },
    );
    return rows.map((r) => {
      const failed = Number(r.failed);
      const completed = Number(r.completed);
      const total = failed + completed;
      return {
        lessonId: r.lesson_id,
        failedCount: failed,
        completedCount: completed,
        failureRate: total === 0 ? 0 : Math.round((failed * 100) / total),
      };
    });
  }

  async getTenantComparison(): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      dau: number;
      eventsLast30d: number;
    }>
  > {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
      where: { status: 'active' },
    });

    if (tenants.length === 0) return [];

    const tenantIds = tenants.map((t) => t.id);
    const rows = await this.clickhouse.query<{
      tenant_id: string;
      dau: string;
      events_30d: string;
    }>(
      `SELECT
         toString(tenant_id) AS tenant_id,
         toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 1 DAY)) AS dau,
         toString(countIf(created_at >= now() - INTERVAL 30 DAY)) AS events_30d
       FROM events
       WHERE tenant_id IN {tenantIds:Array(UUID)}
       GROUP BY tenant_id`,
      { tenantIds },
    );

    const statsMap = new Map<string, { dau: number; eventsLast30d: number }>();
    for (const r of rows) {
      statsMap.set(r.tenant_id, {
        dau: Number(r.dau),
        eventsLast30d: Number(r.events_30d),
      });
    }

    return tenants.map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      dau: statsMap.get(t.id)?.dau ?? 0,
      eventsLast30d: statsMap.get(t.id)?.eventsLast30d ?? 0,
    }));
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
