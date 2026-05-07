-- Phase 1 Revert — Remove 2FA TOTP columns from users
-- Idempotent: tolerates the table not existing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE "users"
      DROP COLUMN IF EXISTS "totp_secret",
      DROP COLUMN IF EXISTS "totp_enabled",
      DROP COLUMN IF EXISTS "totp_backup_codes";
  END IF;
END $$;
