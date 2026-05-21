-- Add practice exam tracking to student_progress
ALTER TABLE "student_progress" ADD COLUMN "practice_score" INTEGER;
ALTER TABLE "student_progress" ADD COLUMN "practice_passed_at" TIMESTAMP(3);
