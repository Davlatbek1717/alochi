-- Phase 35 — Performance indexes
-- Added after EXPLAIN ANALYZE identified sequential scans on these
-- high-frequency query paths. All indexes are created CONCURRENTLY
-- so the table is not locked during creation on a live database.
-- Re-running this migration is safe: IF NOT EXISTS guards each index.

-- student_progress: two common WHERE patterns:
-- (1) "all progress for student X" and (2) "completed lessons for student X".
-- A composite partial index covers (2) and accelerates (1) with the same b-tree.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_student_progress_student_completed
  ON student_progress (student_id, academy_completed)
  WHERE academy_completed = true;

-- exam_permissions: every exam runner poll hits (student_id, status='active').
-- A partial index keeps it small and fast.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_exam_permissions_student_active
  ON exam_permissions (student_id, status)
  WHERE status = 'active';

-- users: most common role+status filter used by analytics, cron jobs,
-- and the student showcase endpoint.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_users_role_status_tenant
  ON users (tenant_id, role, status)
  WHERE status = 'active';
