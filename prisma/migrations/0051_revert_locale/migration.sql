-- Phase 3 Revert — Remove default_locale from tenants (Uzbek-only UI)
-- Idempotent: tolerates the table not existing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) THEN
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "default_locale";
  END IF;
END $$;
