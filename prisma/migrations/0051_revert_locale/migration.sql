-- Phase 3 Revert — Remove default_locale from tenants (Uzbek-only UI)
ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "default_locale";
