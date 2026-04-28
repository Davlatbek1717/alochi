CREATE TABLE "analytics_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "student_id" UUID,
  "branch_id" UUID,
  "data" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_tenant_event_time_idx" ON "analytics_events"("tenant_id", "event_type", "created_at");
CREATE INDEX "analytics_events_tenant_branch_time_idx" ON "analytics_events"("tenant_id", "branch_id", "created_at");

CREATE MATERIALIZED VIEW lesson_stats_mv AS
SELECT
  sp.lesson_id,
  l.tenant_id,
  COUNT(DISTINCT sp.student_id) AS total_students,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed) AS passed,
  ROUND(
    COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed)::numeric
    / NULLIF(COUNT(DISTINCT sp.student_id), 0) * 100, 1
  ) AS pass_rate,
  ROUND(AVG(sp.session_count), 1) AS avg_sessions,
  ROUND(AVG(lf.rating)::numeric, 2) AS feedback_avg
FROM student_progress sp
JOIN lessons l ON sp.lesson_id = l.id
LEFT JOIN lesson_feedbacks lf ON sp.lesson_id = lf.lesson_id AND sp.student_id = lf.student_id
GROUP BY sp.lesson_id, l.tenant_id;

CREATE UNIQUE INDEX lesson_stats_mv_lesson_idx ON lesson_stats_mv(lesson_id);

CREATE MATERIALIZED VIEW branch_stats_mv AS
SELECT
  u.branch_id,
  u.tenant_id,
  COUNT(DISTINCT u.id) AS active_students,
  ROUND(AVG(sx.current_streak), 1) AS avg_streak,
  ROUND(AVG(sx.total_xp), 0) AS avg_xp
FROM users u
JOIN student_xp sx ON u.id = sx.student_id
WHERE u.role = 'student' AND u.status = 'active'
GROUP BY u.branch_id, u.tenant_id;

CREATE UNIQUE INDEX branch_stats_mv_branch_idx ON branch_stats_mv(branch_id, tenant_id);
