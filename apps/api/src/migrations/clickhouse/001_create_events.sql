CREATE TABLE IF NOT EXISTS events (
  event_id      UUID DEFAULT generateUUIDv4(),
  tenant_id     UUID,
  event_type    LowCardinality(String),
  student_id    Nullable(UUID),
  branch_id     Nullable(UUID),
  lesson_id     Nullable(UUID),
  session_count UInt16   DEFAULT 0,
  is_present    Nullable(UInt8),
  is_late       Nullable(UInt8),
  new_streak    Nullable(UInt16),
  data          String,
  created_at    DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, event_type, created_at, student_id);
