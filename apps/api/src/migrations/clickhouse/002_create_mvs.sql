CREATE MATERIALIZED VIEW IF NOT EXISTS dau_daily
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (tenant_id, day)
AS
SELECT
  tenant_id,
  toDate(created_at) AS day,
  uniqState(student_id) AS dau_state
FROM events
WHERE student_id IS NOT NULL
GROUP BY tenant_id, day;

CREATE MATERIALIZED VIEW IF NOT EXISTS lesson_failures
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (tenant_id, lesson_id, day)
AS
SELECT
  tenant_id,
  lesson_id,
  toDate(created_at) AS day,
  countIf(event_type = 'lesson_failed') AS failed_count,
  countIf(event_type = 'lesson_completed') AS completed_count
FROM events
WHERE lesson_id IS NOT NULL
GROUP BY tenant_id, lesson_id, day;
