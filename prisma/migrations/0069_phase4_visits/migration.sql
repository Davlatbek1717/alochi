-- Faza 4: Home Visit module
-- Adds home address fields to users, and HomeVisit + related tables.

-- User: home address + parent contact fields
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "homeAddress"        TEXT,
  ADD COLUMN IF NOT EXISTS "homeLatitude"       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "homeLongitude"      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "homeNotes"          TEXT,
  ADD COLUMN IF NOT EXISTS "preferredVisitTime" TEXT,
  ADD COLUMN IF NOT EXISTS "parentPhone"        TEXT,
  ADD COLUMN IF NOT EXISTS "parentName"         TEXT;

-- VisitStatus enum
CREATE TYPE "VisitStatus" AS ENUM (
  'planned', 'in_progress', 'completed', 'cancelled', 'no_show'
);

-- HomeVisit
CREATE TABLE "HomeVisit" (
  "id"                 TEXT         NOT NULL PRIMARY KEY,
  "studentId"          TEXT         NOT NULL,
  "visitorId"          TEXT         NOT NULL,
  "branchId"           TEXT         NOT NULL,
  "status"             "VisitStatus" NOT NULL DEFAULT 'planned',
  "scheduledFor"       TIMESTAMPTZ  NOT NULL,
  "startedAt"          TIMESTAMPTZ,
  "completedAt"        TIMESTAMPTZ,
  "cancelledAt"        TIMESTAMPTZ,
  "cancelReason"       TEXT,
  "durationMin"        INT,
  "riskScoreAtPlan"    INT,
  "homeAddress"        TEXT,
  "homeLatitude"       DOUBLE PRECISION,
  "homeLongitude"      DOUBLE PRECISION,
  "checkinLatitude"    DOUBLE PRECISION,
  "checkinLongitude"   DOUBLE PRECISION,
  "checkinAccuracy"    DOUBLE PRECISION,
  "checkinDistance"    DOUBLE PRECISION,
  "outcome"            TEXT,
  "notes"              TEXT,
  "aiSummary"          TEXT,
  "followUpDate"       TIMESTAMPTZ,
  "followUpReason"     TEXT,
  "parentSignatureUrl" TEXT,
  "parentPin"          TEXT,
  "parentSignedAt"     TIMESTAMPTZ,
  "tenantId"           TEXT         NOT NULL,
  "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX "HomeVisit_visitorId_scheduledFor_idx"      ON "HomeVisit" ("visitorId", "scheduledFor");
CREATE INDEX "HomeVisit_studentId_completedAt_idx"       ON "HomeVisit" ("studentId", "completedAt");
CREATE INDEX "HomeVisit_branchId_status_scheduledFor_idx" ON "HomeVisit" ("branchId", "status", "scheduledFor");

-- VisitPhoto
CREATE TABLE "VisitPhoto" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "visitId"      TEXT        NOT NULL REFERENCES "HomeVisit"("id") ON DELETE CASCADE,
  "category"     TEXT        NOT NULL,
  "s3Key"        TEXT        NOT NULL,
  "thumbnailKey" TEXT        NOT NULL,
  "caption"      TEXT,
  "takenAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "geoLatitude"  DOUBLE PRECISION,
  "geoLongitude" DOUBLE PRECISION
);
CREATE INDEX "VisitPhoto_visitId_idx" ON "VisitPhoto" ("visitId");

-- VisitChecklistItem
CREATE TABLE "VisitChecklistItem" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "visitId"     TEXT NOT NULL REFERENCES "HomeVisit"("id") ON DELETE CASCADE,
  "templateKey" TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "notes"       TEXT,
  "evidence"    TEXT
);
CREATE INDEX "VisitChecklistItem_visitId_idx" ON "VisitChecklistItem" ("visitId");

-- VisitActionItem
CREATE TABLE "VisitActionItem" (
  "id"          TEXT        NOT NULL PRIMARY KEY,
  "visitId"     TEXT        NOT NULL REFERENCES "HomeVisit"("id") ON DELETE CASCADE,
  "description" TEXT        NOT NULL,
  "priority"    TEXT        NOT NULL,
  "assigneeId"  TEXT,
  "dueDate"     TIMESTAMPTZ,
  "status"      TEXT        NOT NULL DEFAULT 'open',
  "completedAt" TIMESTAMPTZ,
  "generatedBy" TEXT        NOT NULL DEFAULT 'user'
);
CREATE INDEX "VisitActionItem_visitId_idx" ON "VisitActionItem" ("visitId");

-- VisitIssue
CREATE TABLE "VisitIssue" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "visitId"     TEXT NOT NULL REFERENCES "HomeVisit"("id") ON DELETE CASCADE,
  "category"    TEXT NOT NULL,
  "severity"    TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolution"  TEXT,
  "resolvedAt"  TIMESTAMPTZ
);
CREATE INDEX "VisitIssue_visitId_idx" ON "VisitIssue" ("visitId");
