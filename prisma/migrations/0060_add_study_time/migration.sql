-- Daily study-time tracking + per-branch minimum threshold.

-- 1. Per-branch daily minimum study minutes (0 = no requirement).
ALTER TABLE "branches"
  ADD COLUMN "min_daily_study_minutes" INTEGER NOT NULL DEFAULT 0;

-- 2. One row per student per Tashkent calendar day.
CREATE TABLE "study_time_daily" (
  "id"           UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id"   UUID NOT NULL,
  "tenant_id"    UUID NOT NULL,
  "branch_id"    UUID,
  "date"         DATE NOT NULL,
  "seconds"      INTEGER NOT NULL DEFAULT 0,
  "last_ping_at" TIMESTAMP(3) NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "study_time_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "study_time_daily_student_id_date_key"
  ON "study_time_daily"("student_id", "date");
CREATE INDEX "study_time_daily_branch_id_date_idx"
  ON "study_time_daily"("branch_id", "date");
CREATE INDEX "study_time_daily_date_idx"
  ON "study_time_daily"("date");

ALTER TABLE "study_time_daily"
  ADD CONSTRAINT "study_time_daily_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
