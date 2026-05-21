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

  // ───────────────────────────────────────────────────────────────────────────
  // Lesson stats — backed by lesson_stats_mv (Postgres materialized view).
  // ───────────────────────────────────────────────────────────────────────────
  async getLessonStats(tenantId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          lesson_id: string;
          lesson_title: string;
          pass_rate: number;
          total_students: number;
          passed: number;
          avg_sessions: number;
          feedback_avg: number | null;
        }>
      >(
        `SELECT lesson_id, lesson_title, pass_rate, total_students, passed, avg_sessions, feedback_avg
         FROM lesson_stats_mv WHERE tenant_id = $1::uuid`,
        tenantId,
      );
      return rows.map((r) => ({
        lessonId: r.lesson_id,
        lessonTitle: r.lesson_title,
        passRate: Number(r.pass_rate),
        totalStudents: Number(r.total_students),
        passed: Number(r.passed),
        avgSessions: Number(r.avg_sessions),
        feedbackAvg: r.feedback_avg != null ? Number(r.feedback_avg) : null,
      }));
    } catch (err) {
      this.logger.warn(
        `getLessonStats fallback to []: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Branch stats — backed by branch_stats_mv (Postgres materialized view).
  // ───────────────────────────────────────────────────────────────────────────
  async getBranchStats(tenantId: string) {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          branch_id: string;
          branch_name: string;
          total_students: number;
          total_sessions: number;
          lessons_passed: number;
          pass_rate: number;
        }>
      >(
        `SELECT branch_id, branch_name, total_students, total_sessions, lessons_passed, pass_rate
         FROM branch_stats_mv WHERE tenant_id = $1::uuid`,
        tenantId,
      );
      return rows.map((r) => ({
        branchId: r.branch_id,
        branchName: r.branch_name,
        totalStudents: Number(r.total_students),
        totalSessions: Number(r.total_sessions),
        lessonsPassed: Number(r.lessons_passed),
        passRate: Number(r.pass_rate),
      }));
    } catch (err) {
      this.logger.warn(
        `getBranchStats fallback to []: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Student activity — Postgres path when ClickHouse unavailable.
  // Returns { day, count } for last 7 or 30 days.
  // ───────────────────────────────────────────────────────────────────────────
  async getStudentActivity(tenantId: string, period: 'weekly' | 'monthly') {
    const days = period === 'weekly' ? 7 : 30;

    if (!this.clickhouse.isReady()) {
      return this.getStudentActivityFromPostgres(tenantId, days);
    }

    try {
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
    } catch (err) {
      this.logger.warn(
        `getStudentActivity ClickHouse failed, falling back to Postgres: ${(err as Error).message}`,
      );
      return this.getStudentActivityFromPostgres(tenantId, days);
    }
  }

  private async getStudentActivityFromPostgres(
    tenantId: string,
    days: number,
  ): Promise<Array<{ day: string; count: number }>> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ day: string; count: bigint }>
      >(
        Prisma.sql`
          SELECT
            to_char(
              sp.last_activity_at AT TIME ZONE 'Asia/Tashkent',
              'YYYY-MM-DD'
            ) AS day,
            COUNT(DISTINCT sp.student_id) AS count
          FROM student_progress sp
          JOIN users u ON u.id = sp.student_id
          WHERE u.tenant_id = ${tenantId}::uuid
            AND sp.last_activity_at >= now() - (${days} || ' days')::interval
            AND sp.last_activity_at IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `,
      );
      return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
    } catch (err) {
      this.logger.warn(
        `getStudentActivityFromPostgres failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Study-time — daily average minutes + share of students below their
  // branch minimum. ClickHouse (study_time_daily events) with a Postgres
  // fallback (study_time_daily table) so it works without ClickHouse.
  // ───────────────────────────────────────────────────────────────────────────
  async getStudyTime(
    tenantId: string,
    days = 14,
  ): Promise<
    Array<{
      day: string;
      avgMinutes: number;
      students: number;
      belowPct: number;
    }>
  > {
    const d = Math.min(Math.max(days, 1), 90);

    if (!this.clickhouse.isReady()) {
      return this.getStudyTimeFromPostgres(tenantId, d);
    }
    try {
      const rows = await this.clickhouse.query<{
        day: string;
        avg_minutes: string;
        students: string;
        below_pct: string;
      }>(
        `SELECT toDate(created_at)::String AS day,
                round(avg(JSONExtractUInt(data, 'minutes')), 1)::String AS avg_minutes,
                count()::String AS students,
                round(100 * countIf(JSONExtractBool(data, 'below')) / count(), 1)::String AS below_pct
         FROM events
         WHERE tenant_id = {tenantId:UUID}
           AND event_type = 'study_time_daily'
           AND created_at >= now() - INTERVAL ${d} DAY
         GROUP BY day ORDER BY day`,
        { tenantId },
      );
      return rows.map((r) => ({
        day: r.day,
        avgMinutes: Number(r.avg_minutes),
        students: Number(r.students),
        belowPct: Number(r.below_pct),
      }));
    } catch (err) {
      this.logger.warn(
        `getStudyTime ClickHouse failed, falling back to Postgres: ${(err as Error).message}`,
      );
      return this.getStudyTimeFromPostgres(tenantId, d);
    }
  }

  private async getStudyTimeFromPostgres(
    tenantId: string,
    days: number,
  ): Promise<
    Array<{
      day: string;
      avgMinutes: number;
      students: number;
      belowPct: number;
    }>
  > {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          day: string;
          avg_minutes: number;
          students: bigint;
          below_pct: number;
        }>
      >(
        Prisma.sql`
          SELECT
            to_char(s.date, 'YYYY-MM-DD') AS day,
            round(avg(s.seconds / 60.0), 1) AS avg_minutes,
            count(*) AS students,
            round(
              100.0 * count(*) FILTER (
                WHERE b.min_daily_study_minutes > 0
                  AND floor(s.seconds / 60) < b.min_daily_study_minutes
              ) / count(*),
              1
            ) AS below_pct
          FROM study_time_daily s
          JOIN users u
            ON u.id = s.student_id AND u.tenant_id = ${tenantId}::uuid
          LEFT JOIN branches b ON b.id = s.branch_id
          WHERE s.date >= current_date - ${days}::int
          GROUP BY 1
          ORDER BY 1
        `,
      );
      return rows.map((r) => ({
        day: r.day,
        avgMinutes: Number(r.avg_minutes),
        students: Number(r.students),
        belowPct: Number(r.below_pct),
      }));
    } catch (err) {
      this.logger.warn(
        `getStudyTimeFromPostgres failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cohort retention — primary: ClickHouse; fallback: PostgreSQL (Prisma).
  // ───────────────────────────────────────────────────────────────────────────
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
    if (this.clickhouse.isReady()) {
      try {
        return await this.getCohortRetentionClickHouse(tenantId, weeks);
      } catch (err) {
        this.logger.warn(
          `getCohortRetention ClickHouse failed, falling back to PG: ${(err as Error).message}`,
        );
      }
    }
    return this.getCohortRetentionPg(tenantId, weeks);
  }

  private async getCohortRetentionClickHouse(
    tenantId: string,
    weeks: number,
  ): Promise<Array<{ cohortWeek: string; size: number; retention: Record<string, number> }>> {
    type Row = {
      cohort_week: string;
      week_offset: string;
      cohort_size: string;
      active: string;
    };
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
    const grouped = new Map<string, { size: number; retention: Record<string, number> }>();
    for (const r of rows) {
      const offset = Number(r.week_offset);
      const size = Number(r.cohort_size);
      const active = Number(r.active);
      const pct = size === 0 ? 0 : Math.round((active * 100) / size);
      if (!grouped.has(r.cohort_week)) {
        grouped.set(r.cohort_week, { size, retention: {} });
      }
      const entry = grouped.get(r.cohort_week)!;
      entry.size = size;
      if (offset >= 0) entry.retention[`week${offset}`] = pct;
    }
    return Array.from(grouped.entries()).map(([cohortWeek, v]) => ({
      cohortWeek,
      size: v.size,
      retention: v.retention,
    }));
  }

  private async getCohortRetentionPg(
    tenantId: string,
    weeks: number,
  ): Promise<Array<{ cohortWeek: string; size: number; retention: Record<string, number> }>> {
    // Activity = any week a student had study time OR was marked present/late.
    // Cohort = week the student's account was created (Tashkent local time).
    type Row = {
      cohort_week: string;
      cohort_size: bigint;
      week_offset: number | null;
      active_count: bigint;
    };

    const rows = await this.prisma.$queryRaw<Row[]>`
      WITH
        cohort_users AS (
          SELECT
            id AS student_id,
            DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Tashkent') AS cohort_week
          FROM users
          WHERE tenant_id = ${tenantId}::uuid
            AND role = 'student'
            AND created_at >= NOW() - (${weeks + 2}::int || ' weeks')::interval
        ),
        cohort_sizes AS (
          SELECT cohort_week, COUNT(*) AS cohort_size
          FROM cohort_users
          GROUP BY cohort_week
        ),
        active_weeks AS (
          SELECT DISTINCT student_id, DATE_TRUNC('week', date) AS active_week
          FROM study_time_daily
          WHERE tenant_id = ${tenantId}::uuid
          UNION
          SELECT DISTINCT student_id, DATE_TRUNC('week', date::timestamp) AS active_week
          FROM attendance_students
          WHERE tenant_id = ${tenantId}::uuid
            AND status IN ('present', 'late')
        ),
        retention_data AS (
          SELECT
            cu.cohort_week,
            (EXTRACT(EPOCH FROM (aw.active_week - cu.cohort_week)) / 604800)::int AS week_offset,
            COUNT(DISTINCT aw.student_id) AS active_count
          FROM cohort_users cu
          JOIN active_weeks aw ON cu.student_id = aw.student_id
            AND (EXTRACT(EPOCH FROM (aw.active_week - cu.cohort_week)) / 604800)::int
                BETWEEN 0 AND ${weeks}
          GROUP BY cu.cohort_week, week_offset
        )
      SELECT
        TO_CHAR(cs.cohort_week, 'IYYY-"W"IW') AS cohort_week,
        cs.cohort_size,
        rd.week_offset,
        COALESCE(rd.active_count, 0) AS active_count
      FROM cohort_sizes cs
      LEFT JOIN retention_data rd ON cs.cohort_week = rd.cohort_week
      WHERE cs.cohort_week <= NOW() AT TIME ZONE 'Asia/Tashkent'
        AND cs.cohort_size > 0
      ORDER BY cs.cohort_week DESC, rd.week_offset ASC NULLS FIRST
    `;

    const grouped = new Map<string, { size: number; retention: Record<string, number> }>();
    for (const r of rows) {
      if (!grouped.has(r.cohort_week)) {
        grouped.set(r.cohort_week, { size: Number(r.cohort_size), retention: {} });
      }
      const entry = grouped.get(r.cohort_week)!;
      if (r.week_offset !== null) {
        const pct =
          entry.size === 0
            ? 0
            : Math.round((Number(r.active_count) * 100) / entry.size);
        entry.retention[`week${r.week_offset}`] = pct;
      }
    }
    return Array.from(grouped.entries()).map(([cohortWeek, v]) => ({
      cohortWeek,
      size: v.size,
      retention: v.retention,
    }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Funnel — Postgres path when ClickHouse unavailable.
  // Steps: started (session_count>=1), completed (home_completed), verified (academy_completed).
  // ───────────────────────────────────────────────────────────────────────────
  async getFunnel(
    tenantId: string,
    lessonId: string,
  ): Promise<Array<{ step: string; count: number }>> {
    if (!this.clickhouse.isReady()) {
      return this.getFunnelFromPostgres(tenantId, lessonId);
    }

    try {
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
        { step: 'Boshlagan', count: counts['lesson_session'] ?? 0 },
        {
          step: 'Tugatgan',
          count:
            (counts['lesson_session'] ?? 0) - (counts['lesson_failed'] ?? 0),
        },
        {
          step: 'Tester tasdiqi',
          count: counts['lesson_completed'] ?? 0,
        },
      ];
    } catch (err) {
      this.logger.warn(
        `getFunnel ClickHouse failed, falling back to Postgres: ${(err as Error).message}`,
      );
      return this.getFunnelFromPostgres(tenantId, lessonId);
    }
  }

  private async getFunnelFromPostgres(
    tenantId: string,
    lessonId: string,
  ): Promise<Array<{ step: string; count: number }>> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ started: bigint; completed: bigint; verified: bigint }>
      >(
        Prisma.sql`
          SELECT
            COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.session_count >= 1)           AS started,
            COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.home_completed = true)         AS completed,
            COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed = true)      AS verified
          FROM student_progress sp
          JOIN users u ON u.id = sp.student_id
          WHERE sp.lesson_id = ${lessonId}::uuid
            AND u.tenant_id = ${tenantId}::uuid
        `,
      );
      const r = rows[0] ?? { started: 0n, completed: 0n, verified: 0n };
      return [
        { step: 'Boshlagan', count: Number(r.started) },
        { step: 'Tugatgan', count: Number(r.completed) },
        { step: 'Tester tasdiqi', count: Number(r.verified) },
      ];
    } catch (err) {
      this.logger.warn(
        `getFunnelFromPostgres failed: ${(err as Error).message}`,
      );
      return [
        { step: 'Boshlagan', count: 0 },
        { step: 'Tugatgan', count: 0 },
        { step: 'Tester tasdiqi', count: 0 },
      ];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lifecycle (DAU/WAU/MAU) — Postgres path when ClickHouse unavailable.
  // ───────────────────────────────────────────────────────────────────────────
  async getLifecycle(
    tenantId: string,
  ): Promise<{ dau: number; wau: number; mau: number; stickiness: number }> {
    if (!this.clickhouse.isReady()) {
      return this.getLifecycleFromPostgres(tenantId);
    }

    try {
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
    } catch (err) {
      this.logger.warn(
        `getLifecycle ClickHouse failed, falling back to Postgres: ${(err as Error).message}`,
      );
      return this.getLifecycleFromPostgres(tenantId);
    }
  }

  private async getLifecycleFromPostgres(
    tenantId: string,
  ): Promise<{ dau: number; wau: number; mau: number; stickiness: number }> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ dau: bigint; wau: bigint; mau: bigint }>
      >(
        Prisma.sql`
          SELECT
            COUNT(DISTINCT sp.student_id) FILTER (
              WHERE sp.last_activity_at >= now() - INTERVAL '1 day'
            ) AS dau,
            COUNT(DISTINCT sp.student_id) FILTER (
              WHERE sp.last_activity_at >= now() - INTERVAL '7 days'
            ) AS wau,
            COUNT(DISTINCT sp.student_id) FILTER (
              WHERE sp.last_activity_at >= now() - INTERVAL '30 days'
            ) AS mau
          FROM student_progress sp
          JOIN users u ON u.id = sp.student_id
          WHERE u.tenant_id = ${tenantId}::uuid
            AND sp.last_activity_at IS NOT NULL
        `,
      );
      const r = rows[0] ?? { dau: 0n, wau: 0n, mau: 0n };
      const dau = Number(r.dau);
      const wau = Number(r.wau);
      const mau = Number(r.mau);
      const stickiness = mau === 0 ? 0 : Math.round((dau * 100) / mau) / 100;
      return { dau, wau, mau, stickiness };
    } catch (err) {
      this.logger.warn(
        `getLifecycleFromPostgres failed: ${(err as Error).message}`,
      );
      return { dau: 0, wau: 0, mau: 0, stickiness: 0 };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Top failures — Postgres path when ClickHouse unavailable.
  // "Failed" = tried (session_count>=1) but home_completed=false.
  // ───────────────────────────────────────────────────────────────────────────
  async getTopFailures(
    tenantId: string,
    limit = 10,
  ): Promise<
    Array<{
      lessonId: string;
      lessonTitle: string;
      failedCount: number;
      completedCount: number;
      failureRate: number;
    }>
  > {
    if (!this.clickhouse.isReady()) {
      return this.getTopFailuresFromPostgres(tenantId, limit);
    }

    try {
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

      const lessonIds = rows.map((r) => r.lesson_id).filter((id) => !!id);
      const lessons = lessonIds.length
        ? await this.prisma.lesson.findMany({
            where: { id: { in: lessonIds } },
            select: { id: true, title: true },
          })
        : [];
      const titleMap = new Map(lessons.map((l) => [l.id, l.title]));

      return rows.map((r) => {
        const failed = Number(r.failed);
        const completed = Number(r.completed);
        const total = failed + completed;
        return {
          lessonId: r.lesson_id,
          lessonTitle:
            titleMap.get(r.lesson_id) ?? `Dars ${r.lesson_id.slice(0, 8)}`,
          failedCount: failed,
          completedCount: completed,
          failureRate: total === 0 ? 0 : Math.round((failed * 100) / total),
        };
      });
    } catch (err) {
      this.logger.warn(
        `getTopFailures ClickHouse failed, falling back to Postgres: ${(err as Error).message}`,
      );
      return this.getTopFailuresFromPostgres(tenantId, limit);
    }
  }

  private async getTopFailuresFromPostgres(
    tenantId: string,
    limit: number,
  ): Promise<
    Array<{
      lessonId: string;
      lessonTitle: string;
      failedCount: number;
      completedCount: number;
      failureRate: number;
    }>
  > {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          lesson_id: string;
          lesson_title: string;
          failed_count: bigint;
          total_attempts: bigint;
        }>
      >(
        Prisma.sql`
          SELECT
            sp.lesson_id,
            l.title AS lesson_title,
            COUNT(DISTINCT sp.student_id) FILTER (
              WHERE sp.home_completed = false AND sp.session_count >= 1
            ) AS failed_count,
            COUNT(DISTINCT sp.student_id) FILTER (
              WHERE sp.session_count >= 1
            ) AS total_attempts
          FROM student_progress sp
          JOIN lessons l  ON l.id  = sp.lesson_id
          JOIN users   u  ON u.id  = sp.student_id
          WHERE u.tenant_id = ${tenantId}::uuid
          GROUP BY sp.lesson_id, l.title
          HAVING COUNT(DISTINCT sp.student_id) FILTER (
            WHERE sp.home_completed = false AND sp.session_count >= 1
          ) > 0
          ORDER BY failed_count DESC
          LIMIT ${limit}
        `,
      );
      return rows.map((r) => {
        const failed = Number(r.failed_count);
        const total = Number(r.total_attempts);
        return {
          lessonId: r.lesson_id,
          lessonTitle: r.lesson_title,
          failedCount: failed,
          completedCount: total - failed,
          failureRate: total === 0 ? 0 : Math.round((failed * 100) / total),
        };
      });
    } catch (err) {
      this.logger.warn(
        `getTopFailuresFromPostgres failed: ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tenant comparison — enriched with Postgres-backed DAU when CH unavailable.
  // ───────────────────────────────────────────────────────────────────────────
  async getTenantComparison(): Promise<
    Array<{
      tenantId: string;
      tenantName: string;
      activeStudents: number;
      dau: number;
      eventsLast30d: number;
    }>
  > {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
      where: { status: 'active' },
    });

    if (tenants.length === 0) return [];

    type PgAggRow = {
      tenant_id: string;
      active_students: bigint;
      dau: bigint;
      events_30d: bigint;
    };

    // Always compute Postgres-backed metrics (guaranteed data even without CH).
    let pgRows: PgAggRow[] = [];
    try {
      // Pass each tenant id as a parameter — concatenating raw UUIDs into
      // the SQL string would have Postgres parse them as numeric literals
      // (the leading hex digits before the first hyphen). $1::uuid casts
      // each placeholder properly.
      const placeholders = tenants.map((_, i) => `$${i + 1}::uuid`).join(',');
      const params = tenants.map((t) => t.id);
      pgRows = await this.prisma.$queryRawUnsafe<PgAggRow[]>(
        `SELECT
           u.tenant_id::text,
           COUNT(DISTINCT u.id) FILTER (
             WHERE u.role = 'student' AND u.status = 'active'
           ) AS active_students,
           COUNT(DISTINCT sp.student_id) FILTER (
             WHERE sp.last_activity_at >= now() - INTERVAL '1 day'
           ) AS dau,
           COUNT(ae.id) FILTER (
             WHERE ae.created_at >= now() - INTERVAL '30 days'
           ) AS events_30d
         FROM users u
         LEFT JOIN student_progress sp ON sp.student_id = u.id
         LEFT JOIN analytics_events  ae ON ae.tenant_id  = u.tenant_id
         WHERE u.tenant_id IN (${placeholders})
         GROUP BY u.tenant_id`,
        ...params,
      );
    } catch (err) {
      this.logger.warn(
        `getTenantComparison Postgres aggregation failed: ${(err as Error).message}`,
      );
    }

    const pgMap = new Map(
      pgRows.map((r) => [
        r.tenant_id,
        {
          activeStudents: Number(r.active_students),
          dau: Number(r.dau),
          eventsLast30d: Number(r.events_30d),
        },
      ]),
    );

    // Optionally overlay ClickHouse DAU if available.
    const chMap = new Map<string, { dau: number; eventsLast30d: number }>();
    if (this.clickhouse.isReady()) {
      const tenantIds = tenants.map((t) => t.id);
      try {
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
        for (const r of rows) {
          chMap.set(r.tenant_id, {
            dau: Number(r.dau),
            eventsLast30d: Number(r.events_30d),
          });
        }
      } catch (err) {
        this.logger.warn(
          `getTenantComparison ClickHouse fallback to Postgres: ${(err as Error).message}`,
        );
      }
    }

    return tenants.map((t) => {
      const pg = pgMap.get(t.id) ?? {
        activeStudents: 0,
        dau: 0,
        eventsLast30d: 0,
      };
      const ch = chMap.get(t.id);
      return {
        tenantId: t.id,
        tenantName: t.name,
        activeStudents: pg.activeStudents,
        dau: ch?.dau ?? pg.dau,
        eventsLast30d: ch?.eventsLast30d ?? pg.eventsLast30d,
      };
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Log analytics event (unchanged).
  // ───────────────────────────────────────────────────────────────────────────
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

    // 2. ClickHouse — fire-and-forget
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

  // ───────────────────────────────────────────────────────────────────────────
  // Growth — daily new + active students (deterministic, Postgres-only).
  // ───────────────────────────────────────────────────────────────────────────
  async getGrowth(
    tenantId: string,
    days: number,
  ): Promise<{
    totalStudents: number;
    days: Array<{ date: string; newStudents: number; activeStudents: number }>;
  }> {
    const d = Math.max(1, Math.min(90, Math.round(days) || 30));
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{ day: string; new_students: number; active_students: number }>
      >(
        `
        WITH series AS (
          SELECT generate_series(
            (CURRENT_DATE - ($2::int - 1)), CURRENT_DATE, INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          s.day::text AS day,
          (SELECT COUNT(*) FROM users u
             WHERE u.role = 'student' AND u.tenant_id = $1::uuid
               AND u.created_at::date = s.day) AS new_students,
          (SELECT COUNT(DISTINCT std.student_id) FROM study_time_daily std
             WHERE std.tenant_id = $1::uuid AND std.seconds > 0
               AND std.date = s.day) AS active_students
        FROM series s
        ORDER BY s.day
        `,
        tenantId,
        d,
      );
      const totalStudents = await this.prisma.user.count({
        where: { role: 'student', tenantId, status: 'active' },
      });
      return {
        totalStudents,
        days: rows.map((r) => ({
          date: r.day,
          newStudents: Number(r.new_students) || 0,
          activeStudents: Number(r.active_students) || 0,
        })),
      };
    } catch (err) {
      this.logger.warn(`getGrowth failed: ${(err as Error).message}`);
      return { totalStudents: 0, days: [] };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Loyalty — recency/streak segmentation of active students.
  // ───────────────────────────────────────────────────────────────────────────
  async getLoyalty(tenantId: string): Promise<{
    counts: { loyal: number; steady: number; atRisk: number; dormant: number };
    atRisk: Array<{ studentId: string; name: string; daysInactive: number }>;
    dormant: Array<{ studentId: string; name: string; daysInactive: number }>;
  }> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          name: string;
          streak: number;
          red: number;
          days_inactive: number;
        }>
      >(
        `
        WITH s AS (
          SELECT u.id, u.name FROM users u
          WHERE u.role = 'student' AND u.status = 'active'
            AND u.tenant_id = $1::uuid
        )
        SELECT
          s.id::text AS id,
          s.name,
          COALESCE((SELECT current_streak FROM student_streak ss
                    WHERE ss.student_id = s.id), 0) AS streak,
          CASE WHEN EXISTS (
            SELECT 1 FROM student_status x
            WHERE x.student_id = s.id
              AND (x.english_status = 'qizil' OR x.critical_status = 'qizil')
              AND x.date >= (NOW() - INTERVAL '7 days')::date
          ) THEN 1 ELSE 0 END AS red,
          EXTRACT(EPOCH FROM (NOW() - GREATEST(
            COALESCE((SELECT MAX(COALESCE(sp.last_activity_at, sp.completed_at))
                      FROM student_progress sp WHERE sp.student_id = s.id),
                     'epoch'::timestamp),
            COALESCE((SELECT ss.last_activity FROM student_streak ss
                      WHERE ss.student_id = s.id), 'epoch'::timestamp),
            COALESCE((SELECT MAX(std.date)::timestamp FROM study_time_daily std
                      WHERE std.student_id = s.id AND std.seconds > 0),
                     'epoch'::timestamp)
          ))) / 86400.0 AS days_inactive
        FROM s
        `,
        tenantId,
      );

      const counts = { loyal: 0, steady: 0, atRisk: 0, dormant: 0 };
      const atRisk: Array<{
        studentId: string;
        name: string;
        daysInactive: number;
      }> = [];
      const dormant: Array<{
        studentId: string;
        name: string;
        daysInactive: number;
      }> = [];

      for (const r of rows) {
        const di = Math.max(0, Math.round(Number(r.days_inactive) || 0));
        const streak = Number(r.streak) || 0;
        const red = Number(r.red) === 1;
        if (di > 21) {
          counts.dormant++;
          dormant.push({ studentId: r.id, name: r.name, daysInactive: di });
        } else if (di > 7 || red) {
          counts.atRisk++;
          atRisk.push({ studentId: r.id, name: r.name, daysInactive: di });
        } else if (streak >= 7) {
          counts.loyal++;
        } else {
          counts.steady++;
        }
      }
      const byInactiveDesc = (
        a: { daysInactive: number },
        b: { daysInactive: number },
      ) => b.daysInactive - a.daysInactive;
      return {
        counts,
        atRisk: atRisk.sort(byInactiveDesc).slice(0, 25),
        dormant: dormant.sort(byInactiveDesc).slice(0, 25),
      };
    } catch (err) {
      this.logger.warn(`getLoyalty failed: ${(err as Error).message}`);
      return {
        counts: { loyal: 0, steady: 0, atRisk: 0, dormant: 0 },
        atRisk: [],
        dormant: [],
      };
    }
  }
}
