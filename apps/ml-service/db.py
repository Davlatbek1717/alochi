"""PostgreSQL async helper for training data extraction."""
import os
import asyncpg
from typing import List, Dict, Any


async def fetch_training_data() -> List[Dict[str, Any]]:
    """
    Fetch features + labels for churn training.

    Feature snapshot: per student, computed at NOW - 60 days.
    Label: did the student have 7+ absent days in the 30 days following the snapshot?
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
                COALESCE((SELECT COUNT(DISTINCT (a.created_at::date))
                          FROM attendance_students a, snapshot_date sd
                          WHERE a.student_id = s.id
                            AND a.is_present = false
                            AND a.created_at >= sd.d - INTERVAL '30 days'
                            AND a.created_at < sd.d), 0) AS absent_days_30d,
                COALESCE((SELECT current_streak FROM student_xp WHERE student_id = s.id), 0) AS streak_value,
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
                  THEN 1 ELSE 0 END AS has_parent_tg
              FROM students s
            ),
            labels AS (
              SELECT
                s.id AS student_id,
                CASE WHEN COALESCE((SELECT COUNT(DISTINCT (a.created_at::date))
                                    FROM attendance_students a, snapshot_date sd
                                    WHERE a.student_id = s.id
                                      AND a.is_present = false
                                      AND a.created_at >= sd.d
                                      AND a.created_at < sd.d + INTERVAL '30 days'), 0) >= 7
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
              l.churned
            FROM features f
            LEFT JOIN labels l ON l.student_id = f.student_id
            """
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()
