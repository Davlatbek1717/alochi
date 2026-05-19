-- Phase 3: catalogue exams get a per-tenant sequential order number
-- (like lessons.order_number). Backfill existing rows by creation
-- order within each tenant, then enforce uniqueness.

ALTER TABLE "exams" ADD COLUMN "order_number" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "exams"
)
UPDATE "exams" e
SET "order_number" = r.rn
FROM ranked r
WHERE e.id = r.id;

-- Postgres treats NULLs as distinct, so this unique index tolerates the
-- (now backfilled, but future-proofed) nullable column.
CREATE UNIQUE INDEX "exams_tenant_id_order_number_key"
  ON "exams" ("tenant_id", "order_number");
