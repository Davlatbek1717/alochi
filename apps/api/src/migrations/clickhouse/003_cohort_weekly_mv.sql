-- Cohort retention precomputation.
--
-- Goal: for each (tenant, student), determine the student's cohort week
-- (= week of their first observed event) and emit one row per (cohort_week,
-- return_week) so the analytics service can answer cohort-retention queries
-- with a cheap GROUP BY instead of a CTE-with-window-function.
--
-- Why two objects (an Aggregating MV + a regular VIEW) and not a single
-- ENGINE = SummingMergeTree POPULATE-with-window MV:
--   ClickHouse does NOT allow window functions inside the SELECT of a
--   MATERIALIZED VIEW (the MV is recomputed incrementally on every INSERT
--   into the source table — windows over the full table are not safe in that
--   model). So we use the documented two-step pattern:
--     (1) cohort_first_event_mv — AggregatingMergeTree that maintains
--         min(created_at) per (tenant_id, student_id) incrementally;
--     (2) cohort_weekly — a regular VIEW that joins events to (1) and
--         exposes the (tenant_id, cohort_week, return_week, active_users)
--         shape that the analytics service queries.
--
-- Columns mirror 001_create_events.sql: tenant_id, student_id, event_type,
-- created_at (NOT timestamp / user_id).
--
-- Idempotent — safe to run on every deploy.

CREATE MATERIALIZED VIEW IF NOT EXISTS cohort_first_event_mv
ENGINE = AggregatingMergeTree
ORDER BY (tenant_id, student_id)
AS
SELECT
  tenant_id,
  student_id,
  minState(created_at) AS first_event_at_state
FROM events
WHERE student_id IS NOT NULL
  AND event_type = 'lesson_completed'
GROUP BY tenant_id, student_id;

CREATE VIEW IF NOT EXISTS cohort_weekly AS
SELECT
  e.tenant_id            AS tenant_id,
  toStartOfWeek(c.first_event_at) AS cohort_week,
  toStartOfWeek(e.created_at)     AS return_week,
  uniqExact(e.student_id) AS active_users
FROM events AS e
INNER JOIN
(
  SELECT
    tenant_id,
    student_id,
    minMerge(first_event_at_state) AS first_event_at
  FROM cohort_first_event_mv
  GROUP BY tenant_id, student_id
) AS c
USING (tenant_id, student_id)
WHERE e.event_type = 'lesson_completed'
  AND e.student_id IS NOT NULL
GROUP BY tenant_id, cohort_week, return_week;
