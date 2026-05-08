-- migration: 0055_analytics_mvs
-- Creates Postgres materialized views consumed by analytics.service.ts
-- so that Lessons and Branches tabs work without ClickHouse.

-- ─────────────────────────────────────────────────────────────────────────────
-- lesson_stats_mv
-- Scoped by tenant via JOIN with lessons.tenant_id.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS lesson_stats_mv AS
SELECT
  sp.lesson_id,
  l.tenant_id,
  l.title                                                                       AS lesson_title,
  COUNT(DISTINCT sp.student_id)::int                                            AS total_students,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.home_completed = true)::int   AS passed,
  CASE
    WHEN COUNT(DISTINCT sp.student_id) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.home_completed = true)
            / COUNT(DISTINCT sp.student_id)
    )
  END                                                                           AS pass_rate,
  COALESCE(AVG(sp.session_count), 0)::numeric                                  AS avg_sessions,
  NULL::numeric                                                                 AS feedback_avg
FROM student_progress sp
JOIN lessons l ON l.id = sp.lesson_id
GROUP BY sp.lesson_id, l.tenant_id, l.title
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_stats_mv_pk
  ON lesson_stats_mv (tenant_id, lesson_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- branch_stats_mv
-- Counts active students, total sessions, lessons passed, pass-rate per branch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS branch_stats_mv AS
SELECT
  b.id                                                                          AS branch_id,
  b.tenant_id,
  b.name                                                                        AS branch_name,
  COUNT(DISTINCT u.id)
    FILTER (WHERE u.role = 'student' AND u.status = 'active')::int             AS total_students,
  COALESCE(SUM(sp.session_count), 0)::int                                      AS total_sessions,
  COUNT(DISTINCT sp.id)
    FILTER (WHERE sp.home_completed = true)::int                               AS lessons_passed,
  CASE
    WHEN COUNT(DISTINCT sp.id) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(DISTINCT sp.id) FILTER (WHERE sp.home_completed = true)
            / COUNT(DISTINCT sp.id)
    )
  END                                                                           AS pass_rate
FROM branches b
LEFT JOIN users u          ON u.branch_id = b.id
LEFT JOIN student_progress sp ON sp.student_id = u.id
GROUP BY b.id, b.tenant_id, b.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_stats_mv_pk
  ON branch_stats_mv (tenant_id, branch_id);

-- Initial population (CONCURRENTLY requires a unique index and can't run
-- inside a transaction, so we use plain REFRESH here).
REFRESH MATERIALIZED VIEW lesson_stats_mv;
REFRESH MATERIALIZED VIEW branch_stats_mv;
