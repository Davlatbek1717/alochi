-- Phase 33 — Tenant default locale
-- Used when Accept-Language header is absent on API requests.
-- Nullable fallback: existing tenants default to 'uz'.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "default_locale" TEXT NOT NULL DEFAULT 'uz';
