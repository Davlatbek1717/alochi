-- Phase 20.7: Filadmin promotion reports
CREATE TABLE "promotion_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "filadmin_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "students_reached" INTEGER NOT NULL DEFAULT 0,
    "visit_date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promotion_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotion_reports_filadmin_id_idx" ON "promotion_reports"("filadmin_id");
CREATE INDEX "promotion_reports_branch_id_idx" ON "promotion_reports"("branch_id");

ALTER TABLE "promotion_reports" ADD CONSTRAINT "promotion_reports_filadmin_id_fkey"
    FOREIGN KEY ("filadmin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
