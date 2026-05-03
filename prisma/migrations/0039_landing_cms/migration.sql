-- Phase 27 — Superadmin-managed landing CMS
-- Singleton key/value copy (hero, contact, certificate, prizes/sponsor
-- titles, journey settings) plus a polymorphic items table for prize
-- cards, travel-sponsor cards, and journey milestones. Both are read by
-- the public /marketing/landing endpoint and edited at /superadmin/landing.
--
-- Also brings users.region / users.school / users.avatar_url into the
-- migration history. They were added to schema.prisma during the
-- public-showcase work and reached dev DBs via `prisma db push`, but
-- no formal migration was committed — so a fresh `prisma migrate
-- deploy` would leave the columns missing and /marketing/students
-- would crash on production.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "region"     TEXT,
  ADD COLUMN IF NOT EXISTS "school"     TEXT,
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

-- Singleton key/value settings. Read paths defend against pollution
-- with an allow-list against MarketingService.DEFAULT_SETTINGS, but
-- the storage layer is intentionally unconstrained so future keys can
-- ship without a migration.
CREATE TABLE IF NOT EXISTS "site_settings" (
  "key"        TEXT PRIMARY KEY,
  "value"      TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Polymorphic landing list items. `kind` discriminates between
-- "prize", "sponsor", and "milestone". `meta` stores per-kind shape
-- (lessonCount/icon for prizes, city/emoji for sponsors, step/tier
-- for milestones) without requiring a migration when a new kind ships.
CREATE TABLE IF NOT EXISTS "landing_items" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "kind"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "meta"        JSONB,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "is_visible"  BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "landing_items_kind_visible_order_idx"
  ON "landing_items" ("kind", "is_visible", "order_index");
