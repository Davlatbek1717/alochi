CREATE TABLE "error_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "error_count" INTEGER NOT NULL DEFAULT 1,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "error_logs_student_id_lesson_id_question_key"
  ON "error_logs"("student_id", "lesson_id", "question");
CREATE INDEX "error_logs_student_id_error_count_idx" ON "error_logs"("student_id", "error_count");

ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
