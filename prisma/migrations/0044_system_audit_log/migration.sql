-- Phase 32 — System-level security audit log
-- Append-only log of significant admin actions: logins, role changes,
-- user creation/deletion, tenant changes, and subscription events.
-- Protected by an immutability trigger (same pattern as
-- delegation_audit_log) so audit history can't be tampered with even
-- by a compromised superadmin.

CREATE TABLE IF NOT EXISTS "system_audit_log" (
  "id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "actor_id"     UUID,          -- NULL for automated/system events
  "actor_role"   TEXT,
  "tenant_id"    UUID,
  "action"       TEXT NOT NULL, -- e.g. "login", "user.create", "role.change"
  "target_id"    TEXT,          -- affected resource (user id, tenant id, etc.)
  "meta"         JSONB,         -- additional structured context
  "ip_address"   TEXT,
  "user_agent"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "system_audit_log_tenant_created_idx"
  ON "system_audit_log" ("tenant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "system_audit_log_actor_created_idx"
  ON "system_audit_log" ("actor_id", "created_at" DESC);

-- Immutability triggers — audit entries must never be modified or deleted.
DROP TRIGGER IF EXISTS no_update_system_audit ON "system_audit_log";
DROP TRIGGER IF EXISTS no_delete_system_audit ON "system_audit_log";

CREATE TRIGGER no_update_system_audit
  BEFORE UPDATE ON "system_audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();

CREATE TRIGGER no_delete_system_audit
  BEFORE DELETE ON "system_audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();
