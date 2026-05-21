-- Phase 1.5: TOTP 2FA fields on users table
-- Enforced for superadmin and filadmin roles (application-level policy).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret"       TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled"      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totp_backup_codes" TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "totp_enforced_at"  TIMESTAMPTZ;
