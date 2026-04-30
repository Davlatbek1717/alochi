-- Phase 4 — ENUM cleanup
--
-- Replaces 7 String columns with proper Postgres ENUMs so the schema is the
-- single source of truth for valid values. Each ALTER COLUMN backfills the
-- existing data with a USING cast and falls back to a safe default for any
-- row whose current value is not in the enum (e.g. legacy junk strings).
--
-- This migration is idempotent at the type level: each CREATE TYPE is guarded
-- against re-runs so a partially-applied state can be retried.

-- 1. DelegationAction (delegation_responses.action) ---------------------------
DO $$ BEGIN
  CREATE TYPE "DelegationAction" AS ENUM ('accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "delegation_responses"
  ALTER COLUMN "action" TYPE "DelegationAction"
  USING (
    CASE
      WHEN "action" IN ('accepted', 'rejected') THEN "action"::"DelegationAction"
      ELSE 'rejected'::"DelegationAction"
    END
  );

-- 2. FeedEventType (social_feed_events.event_type) ----------------------------
DO $$ BEGIN
  CREATE TYPE "FeedEventType" AS ENUM (
    'lesson_done',
    'streak_milestone',
    'cert_earned',
    'duel_won',
    'streak_broken',
    'city_upgraded',
    'challenge_won'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "social_feed_events"
  ALTER COLUMN "event_type" TYPE "FeedEventType"
  USING (
    CASE
      WHEN "event_type" IN (
        'lesson_done', 'streak_milestone', 'cert_earned',
        'duel_won', 'streak_broken', 'city_upgraded', 'challenge_won'
      ) THEN "event_type"::"FeedEventType"
      ELSE 'lesson_done'::"FeedEventType"
    END
  );

-- 3. FriendshipScope (friendships.scope) --------------------------------------
-- Old schema stored the branch UUID in `scope`; backfill every existing row
-- to 'branch' since branch-scoped is the only mode that ever shipped.
DO $$ BEGIN
  CREATE TYPE "FriendshipScope" AS ENUM ('group', 'branch');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "friendships"
  ALTER COLUMN "scope" DROP DEFAULT;

ALTER TABLE "friendships"
  ALTER COLUMN "scope" TYPE "FriendshipScope"
  USING (
    CASE
      WHEN "scope" = 'group' THEN 'group'::"FriendshipScope"
      ELSE 'branch'::"FriendshipScope"
    END
  );

ALTER TABLE "friendships"
  ALTER COLUMN "scope" SET DEFAULT 'branch'::"FriendshipScope";

-- 4. DuelStatus (duels.status) ------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "DuelStatus" AS ENUM ('pending', 'active', 'completed', 'expired', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "duels"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "duels"
  ALTER COLUMN "status" TYPE "DuelStatus"
  USING (
    CASE
      WHEN "status" IN ('pending', 'active', 'completed', 'expired', 'rejected')
        THEN "status"::"DuelStatus"
      ELSE 'pending'::"DuelStatus"
    END
  );

ALTER TABLE "duels"
  ALTER COLUMN "status" SET DEFAULT 'pending'::"DuelStatus";

-- 5. TaskStatus (tasks.status) ------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('sent', 'seen', 'in_progress', 'done', 'confirmed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "tasks"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "TaskStatus"
  USING (
    CASE
      WHEN "status" IN ('sent', 'seen', 'in_progress', 'done', 'confirmed')
        THEN "status"::"TaskStatus"
      ELSE 'sent'::"TaskStatus"
    END
  );

ALTER TABLE "tasks"
  ALTER COLUMN "status" SET DEFAULT 'sent'::"TaskStatus";

-- 6. WarningType (warnings.type) ---------------------------------------------
-- New column on `warnings`; existing `reason_type` String stays for now
-- (Phase 23 polish will fold it into the enum once UI/back-end agree on
--  the canonical mapping).
DO $$ BEGIN
  CREATE TYPE "WarningType" AS ENUM ('not_prepared', 'no_homework', 'discipline', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "warnings"
  ADD COLUMN IF NOT EXISTS "type" "WarningType" NOT NULL DEFAULT 'other'::"WarningType";

-- 7. ChatModerationStatus (group_messages.moderation_status) -----------------
-- New column on `group_messages` (the chat-message table). Default `approved`
-- so existing messages keep current behaviour; Phase 19 will switch new
-- messages to the `pending` flow.
DO $$ BEGIN
  CREATE TYPE "ChatModerationStatus" AS ENUM ('approved', 'pending', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "group_messages"
  ADD COLUMN IF NOT EXISTS "moderation_status" "ChatModerationStatus"
    NOT NULL DEFAULT 'approved'::"ChatModerationStatus";
