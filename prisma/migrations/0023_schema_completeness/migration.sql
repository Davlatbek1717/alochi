-- Phase 4 — Schema completeness
--
-- Adds the eight missing fields and the partial UNIQUE INDEX called out in
-- the audit. Each ADD COLUMN is guarded so the migration is safe to re-run
-- after a partial failure.

-- group_messages -------------------------------------------------------------
ALTER TABLE "group_messages"
  ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;

-- chat_bans ------------------------------------------------------------------
-- group_id is null for global (cross-group) bans.
ALTER TABLE "chat_bans"
  ADD COLUMN IF NOT EXISTS "group_id" UUID;

-- tasks ----------------------------------------------------------------------
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "seen_at" TIMESTAMP(3);
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3);

-- group_challenges -----------------------------------------------------------
ALTER TABLE "group_challenges"
  ADD COLUMN IF NOT EXISTS "winner_group_id" UUID;

-- tenants --------------------------------------------------------------------
-- Tenant-scoped warning block threshold (default 3 — preserves prior behaviour).
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "warning_block_limit" INTEGER NOT NULL DEFAULT 3;

-- branch_devices -------------------------------------------------------------
-- 90-day JWT expiry — Phase 18 will fully implement the rotation flow.
ALTER TABLE "branch_devices"
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);

-- Partial UNIQUE INDEX -------------------------------------------------------
-- Enforces "at most one active delegation per recipient" at the DB level so
-- a race in delegations.create() can never produce two parallel `active` rows
-- for the same target user.
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_delegation_per_user"
  ON "delegations" ("to_user_id")
  WHERE status = 'active';
