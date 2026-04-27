CREATE TABLE "spaced_repetition" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "ease_factor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "next_review" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "spaced_repetition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "spaced_repetition_student_id_word_key" ON "spaced_repetition"("student_id", "word");
CREATE INDEX "spaced_repetition_student_id_next_review_idx" ON "spaced_repetition"("student_id", "next_review");

ALTER TABLE "spaced_repetition" ADD CONSTRAINT "spaced_repetition_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
