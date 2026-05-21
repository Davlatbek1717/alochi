-- Phase 1 Security: RefreshToken device binding + User security fields + UserStatusHistory

-- RefreshToken: add device binding and rotation chain columns
ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "device_fingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "ip_address"         TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent"          TEXT,
  ADD COLUMN IF NOT EXISTS "last_used_at"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parent_token_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "revoked_at"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revoked_reason"      TEXT;

-- Drop old single-column userId index (replaced by composite below)
DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_revoked_at_idx"
  ON "refresh_tokens"("user_id", "revoked_at");

CREATE INDEX IF NOT EXISTS "refresh_tokens_device_fingerprint_idx"
  ON "refresh_tokens"("device_fingerprint");

-- User: add security tracking columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_login_at"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_login_ip"       TEXT,
  ADD COLUMN IF NOT EXISTS "failed_login_count"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until"        TIMESTAMP(3);

-- UserStatusHistory: new table for audit trail of status changes
CREATE TABLE IF NOT EXISTS "user_status_history" (
  "id"          TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "fromStatus"  TEXT         NOT NULL,
  "toStatus"    TEXT         NOT NULL,
  "changedBy"   TEXT,
  "reason"      TEXT,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_status_history_userId_changedAt_idx"
  ON "user_status_history"("userId", "changedAt");
