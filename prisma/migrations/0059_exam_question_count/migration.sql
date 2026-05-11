-- Add question_count to ai_oral exams. Default 5 covers existing rows
-- so the migration is non-blocking. Subsequent exam-create flows now
-- accept a per-exam override.
ALTER TABLE "exams"
  ADD COLUMN "question_count" INTEGER NOT NULL DEFAULT 5;
