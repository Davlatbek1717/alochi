CREATE TABLE "video_checkins" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "telegram_file_id" TEXT,
  "video_kind" TEXT,
  "duration_sec" INTEGER,
  "submitted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "video_checkins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_checkins_student_id_date_type_key" ON "video_checkins"("student_id", "date", "type");

CREATE INDEX "video_checkins_date_status_idx" ON "video_checkins"("date", "status");

ALTER TABLE "video_checkins" ADD CONSTRAINT "video_checkins_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
