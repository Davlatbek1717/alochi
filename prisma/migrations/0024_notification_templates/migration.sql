-- Phase 6 — Notification Templates
--
-- Per-tenant notification template overrides. Used by Telegram + in-app
-- senders so superadmins can edit notification copy without redeploys.
-- Falls back to hardcoded defaults when a key is not present.

CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id"         UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"  UUID NOT NULL,
  "key"        TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_tenant_key_unique"
  ON "notification_templates" ("tenant_id", "key");
