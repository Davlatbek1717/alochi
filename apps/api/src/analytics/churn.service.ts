import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Churn risk for the superadmin AI analytics section.
 *
 * The dashboard list is computed here from real Postgres signals with a
 * transparent rule-based model, so it ALWAYS works — even when the
 * (optional, separately deployed) Python ml-service is down or hasn't
 * been trained yet. When the ml-service IS reachable we surface its
 * model metrics so the superadmin can see model health; the per-student
 * ranking stays rule-based for determinism and to avoid an N+1 of HTTP
 * calls on every dashboard load.
 */
@Injectable()
export class ChurnService {
  private readonly logger = new Logger(ChurnService.name);
  private readonly mlUrl =
    process.env.ML_SERVICE_URL?.replace(/\/+$/, '') || '';
  private readonly mlTimeoutMs =
    Number(process.env.ML_SERVICE_TIMEOUT_MS) || 2000;

  constructor(private prisma: PrismaService) {}

  /**
   * Per-student churn features for every active student in the tenant,
   * in one query. Schema-accurate (attendance uses `status`/`date`,
   * streak lives in `student_streak`). `xp_gained_7d` has no source
   * table in the current schema so it is intentionally omitted.
   */
  private async extractFeatures(tenantId: string): Promise<
    Array<{
      student_id: string;
      name: string;
      branch_id: string | null;
      absent_days_30d: number;
      streak_value: number;
      lessons_completed_30d: number;
      lessons_failed_30d: number;
      has_red_status: number;
      has_parent_tg: number;
      pass_rate_30d: number;
      pass_rate_change: number;
      avg_session_count: number;
    }>
  > {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<Record<string, unknown>>
    >(
      `
      WITH students AS (
        SELECT u.id, u.name, u.branch_id, u.parent_telegram_id
        FROM users u
        WHERE u.role = 'student' AND u.status = 'active'
          AND u.tenant_id = $1::uuid
      )
      SELECT
        s.id::text AS student_id,
        s.name,
        s.branch_id::text AS branch_id,
        COALESCE((SELECT COUNT(*) FROM attendance_students a
                  WHERE a.student_id = s.id AND a.status = 'absent'
                    AND a.date >= NOW() - INTERVAL '30 days'), 0) AS absent_days_30d,
        COALESCE((SELECT current_streak FROM student_streak
                  WHERE student_id = s.id), 0) AS streak_value,
        COALESCE((SELECT COUNT(*) FROM analytics_events e
                  WHERE e.student_id = s.id AND e.event_type = 'lesson_completed'
                    AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS lessons_completed_30d,
        COALESCE((SELECT COUNT(*) FROM analytics_events e
                  WHERE e.student_id = s.id AND e.event_type = 'lesson_failed'
                    AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS lessons_failed_30d,
        CASE WHEN EXISTS (
          SELECT 1 FROM student_status ss
          WHERE ss.student_id = s.id
            AND (ss.english_status = 'qizil' OR ss.critical_status = 'qizil')
            AND ss.date >= (NOW() - INTERVAL '14 days')::date
        ) THEN 1 ELSE 0 END AS has_red_status,
        CASE WHEN s.parent_telegram_id IS NOT NULL THEN 1 ELSE 0 END AS has_parent_tg,
        COALESCE((SELECT
          CASE WHEN SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END) > 0
               THEN ROUND((SUM(CASE WHEN e.event_type = 'lesson_completed' THEN 1 ELSE 0 END) * 100.0)
                          / NULLIF(SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END), 0), 2)
               ELSE 0 END
          FROM analytics_events e
          WHERE e.student_id = s.id
            AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS pass_rate_30d,
        COALESCE((SELECT
          CASE WHEN SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END) > 0
               THEN ROUND((SUM(CASE WHEN e.event_type = 'lesson_completed' THEN 1 ELSE 0 END) * 100.0)
                          / NULLIF(SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END), 0), 2)
               ELSE 0 END
          FROM analytics_events e
          WHERE e.student_id = s.id
            AND e.created_at >= NOW() - INTERVAL '7 days'), 0)
        - COALESCE((SELECT
          CASE WHEN SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END) > 0
               THEN ROUND((SUM(CASE WHEN e.event_type = 'lesson_completed' THEN 1 ELSE 0 END) * 100.0)
                          / NULLIF(SUM(CASE WHEN e.event_type IN ('lesson_completed','lesson_failed') THEN 1 ELSE 0 END), 0), 2)
               ELSE 0 END
          FROM analytics_events e
          WHERE e.student_id = s.id
            AND e.created_at >= NOW() - INTERVAL '14 days'
            AND e.created_at < NOW() - INTERVAL '7 days'), 0) AS pass_rate_change,
        COALESCE((SELECT AVG(sp.session_count)::float
                  FROM student_progress sp
                  WHERE sp.student_id = s.id
                    AND COALESCE(sp.last_activity_at, sp.completed_at) >= NOW() - INTERVAL '30 days'), 0) AS avg_session_count
      FROM students s
      `,
      tenantId,
    );
    return rows.map((r) => ({
      student_id: String(r.student_id),
      name: String(r.name ?? ''),
      branch_id: r.branch_id ? String(r.branch_id) : null,
      absent_days_30d: Number(r.absent_days_30d) || 0,
      streak_value: Number(r.streak_value) || 0,
      lessons_completed_30d: Number(r.lessons_completed_30d) || 0,
      lessons_failed_30d: Number(r.lessons_failed_30d) || 0,
      has_red_status: Number(r.has_red_status) || 0,
      has_parent_tg: Number(r.has_parent_tg) || 0,
      pass_rate_30d: Number(r.pass_rate_30d) || 0,
      pass_rate_change: Number(r.pass_rate_change) || 0,
      avg_session_count: Number(r.avg_session_count) || 0,
    }));
  }

  /**
   * Transparent 0–100 churn risk (higher = more likely to drop out).
   * Each term is bounded so no single signal can dominate, and the
   * dominant reasons are returned so the UI can explain the score.
   */
  private ruleScore(f: {
    absent_days_30d: number;
    streak_value: number;
    lessons_completed_30d: number;
    lessons_failed_30d: number;
    has_red_status: number;
    has_parent_tg: number;
    pass_rate_30d: number;
    pass_rate_change: number;
  }): { score: number; factors: string[] } {
    const factors: { w: number; label: string }[] = [];

    const absencePts = Math.min(f.absent_days_30d, 10) / 10 * 30;
    if (absencePts > 0)
      factors.push({
        w: absencePts,
        label: `30 kunda ${f.absent_days_30d} marta kelmagan`,
      });

    const totalLessons = f.lessons_completed_30d + f.lessons_failed_30d;
    let inactivityPts = 0;
    if (totalLessons === 0) {
      inactivityPts = 35;
      factors.push({ w: 35, label: '30 kunda dars faolligi yoʻq' });
    } else if (f.lessons_completed_30d === 0) {
      inactivityPts = 20;
      factors.push({ w: 20, label: '30 kunda birorta dars tugatilmagan' });
    }

    let lowPassPts = 0;
    if (totalLessons > 0 && f.pass_rate_30d < 50) {
      lowPassPts = ((50 - f.pass_rate_30d) / 50) * 20;
      factors.push({
        w: lowPassPts,
        label: `Past oʻzlashtirish: ${Math.round(f.pass_rate_30d)}%`,
      });
    }

    let decliningPts = 0;
    if (f.pass_rate_change < 0) {
      decliningPts = (Math.min(-f.pass_rate_change, 50) / 50) * 10;
      factors.push({
        w: decliningPts,
        label: `Natija pasaymoqda (${Math.round(f.pass_rate_change)}%)`,
      });
    }

    let redPts = 0;
    if (f.has_red_status === 1) {
      redPts = 15;
      factors.push({ w: 15, label: 'Qizil holatda' });
    }

    let streakPts = 0;
    if (f.streak_value === 0) {
      streakPts = 10;
      factors.push({ w: 10, label: 'Streak yoʻq' });
    } else if (f.streak_value < 3) {
      streakPts = 5;
      factors.push({ w: 5, label: 'Streak juda past' });
    }

    let raw =
      absencePts +
      inactivityPts +
      lowPassPts +
      decliningPts +
      redPts +
      streakPts;
    if (f.has_parent_tg === 1) raw -= 5; // parent oversight is protective

    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const topFactors = factors
      .sort((a, b) => b.w - a.w)
      .slice(0, 3)
      .map((x) => x.label);
    return { score, factors: topFactors };
  }

  /**
   * Ranked at-risk students for the tenant. `method` is always 'rule'
   * for the list; ml model health is exposed separately via metrics().
   */
  async getChurnList(
    tenantId: string,
    limit = 50,
  ): Promise<{
    method: 'rule';
    generatedAt: string;
    students: Array<{
      studentId: string;
      name: string;
      score: number;
      risk: 'high' | 'medium' | 'low';
      factors: string[];
    }>;
  }> {
    const lim = Math.max(1, Math.min(200, Math.round(limit) || 50));
    const feats = await this.extractFeatures(tenantId);
    const scored = feats
      .map((f) => {
        const { score, factors } = this.ruleScore(f);
        const risk: 'high' | 'medium' | 'low' =
          score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
        return {
          studentId: f.student_id,
          name: f.name,
          score,
          risk,
          factors,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, lim);
    return {
      method: 'rule',
      generatedAt: new Date().toISOString(),
      students: scored,
    };
  }

  /**
   * Best-effort ml-service model health. Never throws — returns
   * `{ available:false }` when the service is unset/unreachable so the
   * UI can show a neutral "model not connected" state.
   */
  async getModelMetrics(): Promise<{
    available: boolean;
    modelVersion?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.mlUrl) return { available: false };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.mlTimeoutMs);
    try {
      const res = await fetch(`${this.mlUrl}/metrics`, {
        signal: ctrl.signal,
      });
      if (!res.ok) return { available: false };
      const metrics = (await res.json()) as Record<string, unknown>;
      return {
        available: true,
        modelVersion:
          typeof metrics.modelVersion === 'string'
            ? metrics.modelVersion
            : undefined,
        metrics,
      };
    } catch {
      return { available: false };
    } finally {
      clearTimeout(t);
    }
  }
}
