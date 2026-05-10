-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "first_name"      TEXT,
  ADD COLUMN "last_name"       TEXT,
  ADD COLUMN "district"        TEXT,
  ADD COLUMN "grade"           INTEGER,
  ADD COLUMN "steps"           JSONB,
  ADD COLUMN "percentage"      INTEGER,
  ADD COLUMN "is_paid"         BOOLEAN,
  ADD COLUMN "blocked_reason"  TEXT,
  ADD COLUMN "joined_at"       TIMESTAMP(3),
  ADD COLUMN "total_points"    INTEGER,
  ADD COLUMN "time_slot"       TEXT,
  ADD COLUMN "warnings"        JSONB,
  ADD COLUMN "warnings_count"  INTEGER,
  ADD COLUMN "crm_student_id"  TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_crm_student_id_key" ON "users"("crm_student_id");
