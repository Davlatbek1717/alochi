-- Phase 26 — public demo request funnel
-- Captures landing-page contact submissions, fans them out to superadmins,
-- and tracks the triage lifecycle through to atomic tenant conversion.

-- Enums
DO $$ BEGIN
  CREATE TYPE "ContactRequestStatus" AS ENUM (
    'new',
    'contacted',
    'demo_scheduled',
    'demo_completed',
    'converted',
    'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CenterSize" AS ENUM ('small', 'medium', 'large');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS "contact_requests" (
  "id"                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "center_name"         TEXT NOT NULL,
  "contact_name"        TEXT NOT NULL,
  "phone"               TEXT NOT NULL,
  "email"               TEXT,
  "center_size"         "CenterSize",
  "message"             TEXT,
  "status"              "ContactRequestStatus" NOT NULL DEFAULT 'new',
  "decline_reason"      TEXT,
  "notes"               TEXT,
  "handled_by"          UUID,
  "handled_at"          TIMESTAMP(3),
  "converted_tenant_id" UUID,
  "ip_address"          TEXT,
  "user_agent"          TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contact_requests_status_idx"
  ON "contact_requests" ("status");
CREATE INDEX IF NOT EXISTS "contact_requests_created_at_idx"
  ON "contact_requests" ("created_at");
