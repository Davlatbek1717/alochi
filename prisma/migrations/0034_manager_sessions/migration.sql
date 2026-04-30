-- Phase 20.8: Manager 1:1 sessions
CREATE TABLE "manager_sessions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "manager_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "manager_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manager_sessions_manager_id_scheduled_at_idx" ON "manager_sessions"("manager_id", "scheduled_at");
CREATE INDEX "manager_sessions_student_id_idx" ON "manager_sessions"("student_id");

ALTER TABLE "manager_sessions" ADD CONSTRAINT "manager_sessions_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manager_sessions" ADD CONSTRAINT "manager_sessions_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
