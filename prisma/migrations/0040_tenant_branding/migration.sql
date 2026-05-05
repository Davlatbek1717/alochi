-- Phase 28 — Tenant whitelabel branding
-- Each tenant can now carry its own display name, logo URL, favicon,
-- and primary accent colour. When set, the dashboard and login page
-- will render the tenant's brand instead of the platform defaults.
-- All columns are nullable so existing tenants keep working without
-- any data change.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "brand_name"    TEXT,
  ADD COLUMN IF NOT EXISTS "logo_url"      TEXT,
  ADD COLUMN IF NOT EXISTS "favicon_url"   TEXT,
  ADD COLUMN IF NOT EXISTS "primary_color" TEXT;
