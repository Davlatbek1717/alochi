"""PostgreSQL async helper for training data extraction."""
import os
import asyncpg
from typing import List, Dict, Any


async def fetch_training_data() -> List[Dict[str, Any]]:
    """
    Fetch features + labels for churn training.

    Feature snapshot: per student, computed at NOW - 60 days.
    Label: did the student have 7+ absent days in the 30 days following the snapshot?

    9-feature set (Phase 14):
      absent_days_30d, streak_value, lessons_completed_30d, lessons_failed_30d,
      has_red_status, has_parent_tg, pass_rate_30d,
      pass_rate_change, avg_session_count, xp_gained_7d.
    """
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        rows = await conn.fetch(
            """
            WITH snapshot_date AS (SELECT NOW() - INTERVAL '60 days' AS d),
            students AS (
              SELECT u.id, u.tenant_id, u.branch_id
              FROM users u
              WHERE u.role = 'student' AND u.status = 'active'
            ),
            features AS (
              SELECT
                s.id AS student_id,
                COALESCE((SELECT COUNT(*)
                          FROM attendance_students a, snapshot_date sd
                          WHERE a.student_id = s.id
                            AND a.status = 'absent'
                            AND a.date >= (sd.d - INTERVAL '30 days')::date
                            AND a.date < sd.d::date), 0) AS absent_days_30d,
                COALESCE((SELECT current_streak FROM student_streak WHERE student_id = s.id), 0) AS streak_value,
                COALESCE((SELECT COUNT(*)
                          FROM analytics_events e, snapshot_date sd
                          WHERE e.student_id = s.id
                            AND e.event_type = 'lesson_completed'
                            AND e.created_at >= sd.d - INTERVAL '30 days'
                            AND e.created_at < sd.d), 0) AS lessons_completed_30d,
                COALESCE((SELECT COUNT(*)
                          FROM analytics_events e, snapshot_date sd
                          WHERE e.student_id = s.id
                            AND e.event_type = 'lesson_failed'
                            AND e.created_at >= sd.d - INTERVAL '30 days'
                            AND e.created_at < sd.d), 0) AS lessons_failed_30d,
                CASE WHEN EXISTS (
                  SELECT 1 FROM student_status ss
                  WHERE ss.student_id = s.id AND ss.english_status = 'qizil'
                ) THEN 1 ELSE 0 END AS has_red_status,
                CASE WHEN (SELECT parent_telegram_id FROM users WHERE id = s.id) IS NOT NULL
                  THEN 1 ELSE 0 END AS has_parent_tg,
                -- This-week pass rate (snapshot - 7d to snapshot).
                COALESCE((SELECT
                  CASE WHEN (SUM(CASE WHEN e.event_type IN ('lesson_completed', 'lesson_failed') THEN 1 ELSE 0 END)) > 0
                       THEN ROUND(
                              (SUM(CASE WHEN e.event_type = 'lesson_completed' THEN 1 ELSE 0 END) * 100.0)
                              / NULLIF(SUM(CASE WHEN e.event_type IN ('lesson_completed', 'lesson_failed') THEN 1 ELSE 0 END), 0),
                              2)
                       ELSE 0 END
                  FROM analytics_events e, snapshot_date sd
                  WHERE e.student_id = s.id
                    AND e.created_at >= sd.d - INTERVAL '7 days'
                    AND e.created_at < sd.d), 0) AS pass_rate_this_week,
                -- Last-week pass rate (snapshot - 14d to snapshot - 7d).
                COALESCE((SELECT
                  CASE WHEN (SUM(CASE WHEN e.event_type IN ('lesson_completed', 'lesson_failed') THEN 1 ELSE 0 END)) > 0
                       THEN ROUND(
                              (SUM(CASE WHEN e.event_type = 'lesson_completed' THEN 1 ELSE 0 END) * 100.0)
                              / NULLIF(SUM(CASE WHEN e.event_type IN ('lesson_completed', 'lesson_failed') THEN 1 ELSE 0 END), 0),
                              2)
                       ELSE 0 END
                  FROM analytics_events e, snapshot_date sd
                  WHERE e.student_id = s.id
                    AND e.created_at >= sd.d - INTERVAL '14 days'
                    AND e.created_at < sd.d - INTERVAL '7 days'), 0) AS pass_rate_last_week,
                COALESCE((SELECT AVG(sp.session_count)::float
                          FROM student_progress sp, snapshot_date sd
                          WHERE sp.student_id = s.id
                            AND COALESCE(sp.last_activity_at, sp.completed_at) >= sd.d - INTERVAL '30 days'
                            AND COALESCE(sp.last_activity_at, sp.completed_at) < sd.d), 0) AS avg_session_count,
                -- No xp_events/xp ledger table exists in the current
                -- schema; the model keeps the 9-feature slot but the
                -- value is always 0 until an XP ledger is introduced.
                0 AS xp_gained_7d
              FROM students s
            ),
            labels AS (
              SELECT
                s.id AS student_id,
                CASE WHEN COALESCE((SELECT COUNT(*)
                                    FROM attendance_students a, snapshot_date sd
                                    WHERE a.student_id = s.id
                                      AND a.status = 'absent'
                                      AND a.date >= sd.d::date
                                      AND a.date < (sd.d + INTERVAL '30 days')::date), 0) >= 7
                     THEN 1 ELSE 0 END AS churned
              FROM students s
            )
            SELECT
              f.student_id::text,
              f.absent_days_30d,
              f.streak_value,
              f.lessons_completed_30d,
              f.lessons_failed_30d,
              f.has_red_status,
              f.has_parent_tg,
              CASE WHEN (f.lessons_completed_30d + f.lessons_failed_30d) > 0
                   THEN ROUND((f.lessons_completed_30d * 100.0) / (f.lessons_completed_30d + f.lessons_failed_30d), 2)
                   ELSE 0 END AS pass_rate_30d,
              (f.pass_rate_this_week - f.pass_rate_last_week) AS pass_rate_change,
              f.avg_session_count,
              f.xp_gained_7d,
              l.churned
            FROM features f
            LEFT JOIN labels l ON l.student_id = f.student_id
            """
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()
