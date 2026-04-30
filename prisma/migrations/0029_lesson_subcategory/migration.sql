-- Phase 20.1: Lesson subcategory + order in subcategory
ALTER TABLE "lessons" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "lessons" ADD COLUMN "order_in_subcategory" INTEGER;

CREATE INDEX "lessons_tenant_id_subcategory_idx" ON "lessons"("tenant_id", "subcategory");
