CREATE TABLE "churn_scores" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "signals" JSONB NOT NULL,
  "alert_sent" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "churn_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "churn_scores_student_id_key" ON "churn_scores"("student_id");
CREATE INDEX "churn_scores_tenant_id_score_idx" ON "churn_scores"("tenant_id", "score");

ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
