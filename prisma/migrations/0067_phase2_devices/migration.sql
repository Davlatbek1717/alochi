-- Faza 2: Device Management
-- Adds Device, DeviceEnrollment, DevicePolicy, DeviceEvent,
-- DeviceCommand, DeviceHealthPing tables.

CREATE TYPE "DeviceStatus" AS ENUM (
  'active', 'inactive', 'lost', 'damaged', 'retired', 'suspicious'
);

CREATE TABLE "Device" (
  "id"              TEXT         NOT NULL PRIMARY KEY,
  "serialNumber"    TEXT         NOT NULL UNIQUE,
  "imei"            TEXT,
  "macAddress"      TEXT,
  "manufacturer"    TEXT,
  "model"           TEXT,
  "osVersion"       TEXT,
  "appVersion"      TEXT,
  "androidId"       TEXT         UNIQUE,
  "enrollmentToken" TEXT         UNIQUE,
  "purchasedAt"     TIMESTAMPTZ,
  "branchId"        TEXT         NOT NULL,
  "tenantId"        TEXT         NOT NULL,
  "status"          "DeviceStatus" NOT NULL DEFAULT 'active',
  "lastSeenAt"      TIMESTAMPTZ,
  "batteryLevel"    INT,
  "storageFreePct"  INT,
  "policyVersion"   INT          NOT NULL DEFAULT 1,
  "fcmToken"        TEXT,
  "deletedAt"       TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX "Device_branchId_status_idx"  ON "Device" ("branchId", "status");
CREATE INDEX "Device_tenantId_status_idx"  ON "Device" ("tenantId", "status");
CREATE INDEX "Device_lastSeenAt_idx"       ON "Device" ("lastSeenAt");

CREATE TABLE "DeviceEnrollment" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "deviceId"     TEXT        NOT NULL REFERENCES "Device"("id"),
  "studentId"    TEXT        NOT NULL,
  "enrolledAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "unenrolledAt" TIMESTAMPTZ,
  "active"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "enrolledBy"   TEXT        NOT NULL
);
CREATE INDEX "DeviceEnrollment_deviceId_active_idx"   ON "DeviceEnrollment" ("deviceId", "active");
CREATE INDEX "DeviceEnrollment_studentId_active_idx"  ON "DeviceEnrollment" ("studentId", "active");
-- Only one active enrollment per device at a time
CREATE UNIQUE INDEX "DeviceEnrollment_one_active_per_device"
  ON "DeviceEnrollment" ("deviceId") WHERE "active" = TRUE;

CREATE TABLE "DevicePolicy" (
  "id"                      TEXT        NOT NULL PRIMARY KEY,
  "branchId"                TEXT        NOT NULL UNIQUE,
  "allowedHoursStart"       TEXT        NOT NULL DEFAULT '06:00',
  "allowedHoursEnd"         TEXT        NOT NULL DEFAULT '23:00',
  "allowedDomains"          TEXT[]      NOT NULL DEFAULT '{}',
  "screenshotIntervalSec"   INT         NOT NULL DEFAULT 300,
  "cameraIntervalSec"       INT         NOT NULL DEFAULT 900,
  "pingIntervalSec"         INT         NOT NULL DEFAULT 60,
  "wifiSsidWhitelist"       TEXT[]      NOT NULL DEFAULT '{}',
  "blockCameraOutsideHours" BOOLEAN     NOT NULL DEFAULT TRUE,
  "forceUpdateMinVersion"   TEXT,
  "policyVersion"           INT         NOT NULL DEFAULT 1,
  "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "DeviceEvent" (
  "id"         TEXT        NOT NULL PRIMARY KEY,
  "deviceId"   TEXT        NOT NULL REFERENCES "Device"("id"),
  "type"       TEXT        NOT NULL,
  "severity"   TEXT        NOT NULL DEFAULT 'info',
  "payload"    JSONB,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "DeviceEvent_deviceId_occurredAt_idx" ON "DeviceEvent" ("deviceId", "occurredAt");
CREATE INDEX "DeviceEvent_type_occurredAt_idx"     ON "DeviceEvent" ("type", "occurredAt");

CREATE TABLE "DeviceCommand" (
  "id"            TEXT        NOT NULL PRIMARY KEY,
  "deviceId"      TEXT        NOT NULL REFERENCES "Device"("id"),
  "type"          TEXT        NOT NULL,
  "payload"       JSONB,
  "status"        TEXT        NOT NULL DEFAULT 'pending',
  "createdBy"     TEXT        NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "sentAt"        TIMESTAMPTZ,
  "ackedAt"       TIMESTAMPTZ,
  "completedAt"   TIMESTAMPTZ,
  "resultPayload" JSONB,
  "expiresAt"     TIMESTAMPTZ NOT NULL
);
CREATE INDEX "DeviceCommand_deviceId_status_idx" ON "DeviceCommand" ("deviceId", "status");

CREATE TABLE "DeviceHealthPing" (
  "id"             TEXT        NOT NULL PRIMARY KEY,
  "deviceId"       TEXT        NOT NULL,
  "batteryLevel"   INT,
  "storageFreePct" INT,
  "networkType"    TEXT,
  "signalStrength" INT,
  "appVersion"     TEXT,
  "pingedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "DeviceHealthPing_deviceId_pingedAt_idx" ON "DeviceHealthPing" ("deviceId", "pingedAt");
