-- #8 — Track when each device's enrollment token was issued/rotated so admins
-- can see token age and respond to a suspected leak by rotating it.
-- Idempotent (ADD COLUMN IF NOT EXISTS). Backfill existing rows to createdAt
-- so age is meaningful for already-enrolled devices.

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "tokenIssuedAt" TIMESTAMP(3);

UPDATE "Device" SET "tokenIssuedAt" = "createdAt" WHERE "tokenIssuedAt" IS NULL;
