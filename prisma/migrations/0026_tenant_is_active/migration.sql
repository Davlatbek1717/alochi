-- Phase 17 — Tenant.isActive
--
-- Adds an `is_active` boolean to `tenants` so superadmin can disable a center
-- (cascade-deactivating its users via tenants.service.disable). Defaults to
-- true so existing tenants stay active after the migration.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
