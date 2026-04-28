CREATE TABLE "lesson_feedbacks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_feedbacks_student_id_lesson_id_key" ON "lesson_feedbacks"("student_id", "lesson_id");

ALTER TABLE "lesson_feedbacks" ADD CONSTRAINT "lesson_feedbacks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_feedbacks" ADD CONSTRAINT "lesson_feedbacks_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lesson_variants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "lesson_id" UUID NOT NULL,
  "variant" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_variants_lesson_id_variant_key" ON "lesson_variants"("lesson_id", "variant");

ALTER TABLE "lesson_variants" ADD CONSTRAINT "lesson_variants_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "student_variant_assignments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_variant_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_variant_assignments_student_id_lesson_id_key" ON "student_variant_assignments"("student_id", "lesson_id");

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "lesson_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
