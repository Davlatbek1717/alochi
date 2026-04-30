-- Phase 20.2: Culture lesson attendance
CREATE TABLE "culture_lesson_attendance" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "staff_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "culture_lesson_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "culture_lesson_attendance_staff_id_date_key" ON "culture_lesson_attendance"("staff_id", "date");
CREATE INDEX "culture_lesson_attendance_staff_id_idx" ON "culture_lesson_attendance"("staff_id");

ALTER TABLE "culture_lesson_attendance" ADD CONSTRAINT "culture_lesson_attendance_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
