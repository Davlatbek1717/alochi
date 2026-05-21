-- Phase 6 Business Logic: XOR constraints, range checks, idempotency fields

-- ExamPermission: exactly one of lesson_id / exam_id must be set (XOR)
-- Prevents phantom permissions that reference neither a lesson nor an exam.
ALTER TABLE "exam_permissions"
  ADD CONSTRAINT "exam_permission_xor"
  CHECK (
    ("lesson_id" IS NULL) <> ("exam_id" IS NULL)
  );

-- StudentBuilding: tier must be between 1 and 5
ALTER TABLE "student_buildings"
  ADD CONSTRAINT "student_building_tier_range"
  CHECK (tier BETWEEN 1 AND 5);

-- KpiScore: score between -100 and 100
ALTER TABLE "kpi_scores"
  ADD CONSTRAINT "kpi_score_range"
  CHECK (score BETWEEN -100 AND 100);

-- Payment: add providerTxId unique + webhookEventId unique for idempotency
-- Prevents double-processing of Payme/Click webhooks that fire more than once.
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "provider_tx_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "webhook_event_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_tx_id_key"
  ON "payments"("provider_tx_id") WHERE "provider_tx_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_webhook_event_id_key"
  ON "payments"("webhook_event_id") WHERE "webhook_event_id" IS NOT NULL;

-- ExamPermission: only one active permission per student+exam at a time.
-- ExamStatus enum: active | done | failed
CREATE UNIQUE INDEX IF NOT EXISTS "exam_permissions_student_exam_active_unique"
  ON "exam_permissions"("student_id", "exam_id")
  WHERE status = 'active' AND "exam_id" IS NOT NULL;

-- Additional indexes from Phase 7 performance audit
CREATE INDEX IF NOT EXISTS "attendance_students_branch_date_idx"
  ON "attendance_students"("branchId", "date");

CREATE INDEX IF NOT EXISTS "attendance_students_student_date_idx"
  ON "attendance_students"("studentId", "date");

CREATE INDEX IF NOT EXISTS "payments_student_month_idx"
  ON "payments"("studentId", "month");

CREATE INDEX IF NOT EXISTS "payments_branch_month_idx"
  ON "payments"("branchId", "month");

CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx"
  ON "notifications"("userId", "read", "createdAt");
