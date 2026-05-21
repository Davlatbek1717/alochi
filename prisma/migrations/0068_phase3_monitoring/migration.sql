-- Faza 3: Activity Monitoring
-- Adds ScreenCapture, PresenceCheck, PageActivity,
-- CheatingSignal, CheatingScore tables.

CREATE TABLE "ScreenCapture" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "deviceId"     TEXT        NOT NULL REFERENCES "Device"("id"),
  "studentId"    TEXT        NOT NULL,
  "capturedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "s3Key"        TEXT        NOT NULL,
  "thumbnailKey" TEXT        NOT NULL,
  "width"        INT         NOT NULL,
  "height"       INT         NOT NULL,
  "byteSize"     INT         NOT NULL,
  "ocrText"      TEXT,
  "appPackage"   TEXT,
  "url"          TEXT,
  "suspicious"   BOOLEAN     NOT NULL DEFAULT FALSE,
  "reviewedAt"   TIMESTAMPTZ,
  "reviewedBy"   TEXT,
  "reviewNote"   TEXT,
  "tenantId"     TEXT        NOT NULL
);
CREATE INDEX "ScreenCapture_studentId_capturedAt_idx" ON "ScreenCapture" ("studentId", "capturedAt");
CREATE INDEX "ScreenCapture_deviceId_capturedAt_idx"  ON "ScreenCapture" ("deviceId",  "capturedAt");
CREATE INDEX "ScreenCapture_suspicious_capturedAt_idx" ON "ScreenCapture" ("suspicious","capturedAt");

CREATE TABLE "PresenceCheck" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "deviceId"      TEXT        NOT NULL,
  "studentId"     TEXT        NOT NULL,
  "capturedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "s3Key"         TEXT        NOT NULL,
  "matchScore"    DOUBLE PRECISION,
  "matched"       BOOLEAN     NOT NULL,
  "faceDetected"  BOOLEAN     NOT NULL,
  "liveness"      BOOLEAN,
  "multipleFaces" BOOLEAN     NOT NULL DEFAULT FALSE,
  "expiresAt"     TIMESTAMPTZ NOT NULL,
  "tenantId"      TEXT        NOT NULL
);
CREATE INDEX "PresenceCheck_studentId_capturedAt_idx" ON "PresenceCheck" ("studentId", "capturedAt");
CREATE INDEX "PresenceCheck_matched_capturedAt_idx"   ON "PresenceCheck" ("matched",   "capturedAt");
CREATE INDEX "PresenceCheck_expiresAt_idx"            ON "PresenceCheck" ("expiresAt");

CREATE TABLE "PageActivity" (
  "id"               TEXT        NOT NULL PRIMARY KEY,
  "studentId"        TEXT        NOT NULL,
  "deviceId"         TEXT,
  "sessionId"        TEXT        NOT NULL,
  "url"              TEXT        NOT NULL,
  "pageType"         TEXT        NOT NULL,
  "resourceId"       TEXT,
  "enteredAt"        TIMESTAMPTZ NOT NULL,
  "leftAt"           TIMESTAMPTZ,
  "durationSec"      INT,
  "scrollDepthPct"   INT,
  "interactionCount" INT         NOT NULL DEFAULT 0,
  "blurEventsCount"  INT         NOT NULL DEFAULT 0,
  "exitReason"       TEXT,
  "tenantId"         TEXT        NOT NULL
);
CREATE INDEX "PageActivity_studentId_enteredAt_idx" ON "PageActivity" ("studentId", "enteredAt");
CREATE INDEX "PageActivity_pageType_enteredAt_idx"  ON "PageActivity" ("pageType",  "enteredAt");
CREATE INDEX "PageActivity_resourceId_idx"          ON "PageActivity" ("resourceId");

CREATE TABLE "CheatingSignal" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "studentId"    TEXT        NOT NULL,
  "deviceId"     TEXT,
  "signalType"   TEXT        NOT NULL,
  "severity"     INT         NOT NULL,
  "detectedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "context"      JSONB       NOT NULL,
  "aiAssessment" TEXT,
  "resolved"     BOOLEAN     NOT NULL DEFAULT FALSE,
  "resolvedBy"   TEXT,
  "resolvedAt"   TIMESTAMPTZ,
  "resolution"   TEXT,
  "tenantId"     TEXT        NOT NULL
);
CREATE INDEX "CheatingSignal_studentId_detectedAt_idx" ON "CheatingSignal" ("studentId", "detectedAt");
CREATE INDEX "CheatingSignal_resolved_severity_idx"    ON "CheatingSignal" ("resolved",  "severity");

CREATE TABLE "CheatingScore" (
  "id"           TEXT    NOT NULL PRIMARY KEY,
  "studentId"    TEXT    NOT NULL,
  "date"         DATE    NOT NULL,
  "score"        INT     NOT NULL,
  "signalsCount" INT     NOT NULL,
  "topReasons"   TEXT[]  NOT NULL DEFAULT '{}',
  "tenantId"     TEXT    NOT NULL,
  UNIQUE ("studentId", "date")
);
CREATE INDEX "CheatingScore_date_score_idx" ON "CheatingScore" ("date", "score");
