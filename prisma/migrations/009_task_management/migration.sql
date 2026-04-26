CREATE TABLE "tasks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "assigned_to" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "checklist" JSONB NOT NULL DEFAULT '[]',
  "deadline" TIMESTAMP(3),
  "kpi_ball" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_assigned_to_status_idx" ON "tasks"("assigned_to", "status");
CREATE INDEX "tasks_created_by_idx" ON "tasks"("created_by");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
