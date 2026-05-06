-- Phase 36 — 2FA TOTP columns on users
-- totpSecret: AES-256-GCM encrypted TOTP secret (nullable — not set until 2FA enabled)
-- totpEnabled: whether 2FA is currently active for this user
-- totpBackupCodes: JSON array of bcrypt-hashed one-time backup codes

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "totp_secret"       TEXT,
  ADD COLUMN IF NOT EXISTS "totp_enabled"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totp_backup_codes" TEXT;
