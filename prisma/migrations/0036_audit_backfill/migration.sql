-- Phase 25 audit backfill schema additions

-- 25.B Lesson runner: cameraEnabled toggle + AI tutor context
ALTER TABLE "lessons"
  ADD COLUMN IF NOT EXISTS "camera_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "ai_tutor_context" TEXT;

-- 25.C.3 Tenant certificate template (JSON design config)
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "cert_template" JSONB;

-- 25.G.1 Persistent exam queue
CREATE TABLE IF NOT EXISTS "exam_queue_entries" (
  "id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id"  UUID NOT NULL,
  "branch_id"  UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "lesson_id"  UUID NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'waiting',
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  "started_at" TIMESTAMP(3),
  "ended_at"   TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "exam_queue_entries_tenant_branch_status_idx"
  ON "exam_queue_entries"("tenant_id","branch_id","status");
CREATE INDEX IF NOT EXISTS "exam_queue_entries_student_idx"
  ON "exam_queue_entries"("student_id");

-- 25.G.2 Tech issue reports
CREATE TABLE IF NOT EXISTS "tech_issues" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id"   UUID NOT NULL,
  "branch_id"   UUID,
  "reported_by" UUID NOT NULL,
  "category"    TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity"    TEXT NOT NULL DEFAULT 'medium',
  "status"      TEXT NOT NULL DEFAULT 'open',
  "resolution"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "tech_issues_tenant_status_idx"
  ON "tech_issues"("tenant_id","status");
CREATE INDEX IF NOT EXISTS "tech_issues_branch_idx"
  ON "tech_issues"("branch_id");

-- 25.E.3 Manager rewards (gift/book registry)
CREATE TABLE IF NOT EXISTS "manager_rewards" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id"   UUID NOT NULL,
  "branch_id"   UUID NOT NULL,
  "manager_id"  UUID NOT NULL,
  "student_id"  UUID NOT NULL,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "given_at"    TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "manager_rewards_tenant_branch_idx"
  ON "manager_rewards"("tenant_id","branch_id");
CREATE INDEX IF NOT EXISTS "manager_rewards_student_idx"
  ON "manager_rewards"("student_id");
