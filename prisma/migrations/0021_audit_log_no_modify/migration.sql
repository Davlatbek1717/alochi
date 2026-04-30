-- Phase 1.4 — audit log immutability
--
-- Audit-log rows must be append-only. We block UPDATE and DELETE on every
-- audit-style table at the trigger level so neither the API nor a
-- compromised admin tool can rewrite history.

CREATE OR REPLACE FUNCTION prevent_audit_modify() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit log entries are immutable';
END;
$$ LANGUAGE plpgsql;

-- delegation_audit_log -------------------------------------------------------

DROP TRIGGER IF EXISTS no_update_delegation_audit ON "delegation_audit_log";
DROP TRIGGER IF EXISTS no_delete_delegation_audit ON "delegation_audit_log";

CREATE TRIGGER no_update_delegation_audit
  BEFORE UPDATE ON "delegation_audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();

CREATE TRIGGER no_delete_delegation_audit
  BEFORE DELETE ON "delegation_audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();
