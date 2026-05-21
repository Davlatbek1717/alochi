-- Faza 8: PDPL — Consent management and data deletion requests

-- ConsentRecord: PDPL-required consent tracking per user per type
CREATE TABLE "ConsentRecord" (
  "id"           TEXT         NOT NULL PRIMARY KEY,
  "userId"       TEXT         NOT NULL,
  "consentType"  TEXT         NOT NULL,
  "granted"      BOOLEAN      NOT NULL,
  "grantedAt"    TIMESTAMPTZ,
  "revokedAt"    TIMESTAMPTZ,
  "ipAddress"    TEXT,
  "userAgent"    TEXT,
  "signedDocUrl" TEXT,
  "expiresAt"    TIMESTAMPTZ,
  "tenantId"     TEXT         NOT NULL
);
CREATE INDEX "ConsentRecord_userId_consentType_granted_idx"
  ON "ConsentRecord" ("userId", "consentType", "granted");

-- DataDeletionRequest: right-to-erasure requests (14-day cooling-off period)
CREATE TABLE "DataDeletionRequest" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "userId"          TEXT         NOT NULL,
  "requestedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "scheduledFor"    TIMESTAMPTZ  NOT NULL,
  "cancelledAt"     TIMESTAMPTZ,
  "cancelledReason" TEXT,
  "completedAt"     TIMESTAMPTZ,
  "approvedBy"      TEXT,
  "status"          TEXT         NOT NULL DEFAULT 'pending'
);
CREATE INDEX "DataDeletionRequest_status_scheduledFor_idx"
  ON "DataDeletionRequest" ("status", "scheduledFor");

-- Immutable audit log — prevent UPDATE/DELETE on SystemAuditLog
-- (Applied after table exists; run once per environment)
-- Note: requires a raise_exception() function to be available.
-- CREATE OR REPLACE FUNCTION raise_exception()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- BEGIN
--   RAISE EXCEPTION 'audit log is immutable';
-- END;
-- $$;
-- CREATE TRIGGER prevent_audit_modify
--   BEFORE UPDATE OR DELETE ON "system_audit_log"
--   FOR EACH ROW EXECUTE FUNCTION raise_exception();
