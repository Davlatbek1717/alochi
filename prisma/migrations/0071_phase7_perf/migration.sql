-- Faza 7: Performance — new indexes for audit log and analytics

-- SystemAuditLog: action-based queries (security dashboards, reports)
CREATE INDEX IF NOT EXISTS "system_audit_log_action_created_at_idx"
  ON "system_audit_log" ("action", "created_at" DESC);

-- AnalyticsEvent: per-student queries (student timeline)
CREATE INDEX IF NOT EXISTS "analytics_events_student_id_created_at_idx"
  ON "analytics_events" ("student_id", "created_at");
