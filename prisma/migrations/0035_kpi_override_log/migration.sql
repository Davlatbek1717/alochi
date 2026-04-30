-- Phase 20.9: KPI override audit log
CREATE TABLE "kpi_override_log" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "old_n" INTEGER,
    "new_n" INTEGER NOT NULL,
    "changed_by" UUID,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_override_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kpi_override_log_student_id_lesson_id_idx" ON "kpi_override_log"("student_id", "lesson_id");
CREATE INDEX "kpi_override_log_changed_at_idx" ON "kpi_override_log"("changed_at");

ALTER TABLE "kpi_override_log" ADD CONSTRAINT "kpi_override_log_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpi_override_log" ADD CONSTRAINT "kpi_override_log_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kpi_override_log" ADD CONSTRAINT "kpi_override_log_changed_by_fkey"
    FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
