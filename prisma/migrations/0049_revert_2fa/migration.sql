-- Phase 1 Revert — Remove 2FA TOTP columns from users
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "totp_secret",
  DROP COLUMN IF EXISTS "totp_enabled",
  DROP COLUMN IF EXISTS "totp_backup_codes";
