-- Make changed_by nullable for system-generated adaptive configs
ALTER TABLE "student_lesson_config" ALTER COLUMN "changed_by" DROP NOT NULL;

CREATE TABLE "adaptive_difficulty_configs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "min_n" INTEGER NOT NULL DEFAULT 1,
  "max_n" INTEGER NOT NULL DEFAULT 10,
  "hard_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
  "easy_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "adaptive_difficulty_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adaptive_difficulty_configs_tenant_id_key" ON "adaptive_difficulty_configs"("tenant_id");

ALTER TABLE "adaptive_difficulty_configs" ADD CONSTRAINT "adaptive_difficulty_configs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "adaptive_difficulty_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "old_n" INTEGER NOT NULL,
  "new_n" INTEGER NOT NULL,
  "error_rate" DOUBLE PRECISION NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "adaptive_difficulty_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "adaptive_difficulty_logs_student_id_idx" ON "adaptive_difficulty_logs"("student_id");
CREATE INDEX "adaptive_difficulty_logs_lesson_id_idx" ON "adaptive_difficulty_logs"("lesson_id");

ALTER TABLE "adaptive_difficulty_logs" ADD CONSTRAINT "adaptive_difficulty_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "adaptive_difficulty_logs" ADD CONSTRAINT "adaptive_difficulty_logs_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
