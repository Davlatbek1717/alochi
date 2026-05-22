-- Device MDM phase 1: GPS location, remote-block state, foreground-app tracking.
-- Idempotent (ADD COLUMN IF NOT EXISTS) so re-runs are safe.

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastLatitude"   DOUBLE PRECISION;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastLongitude"  DOUBLE PRECISION;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "blocked"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "blockReason"    TEXT;

ALTER TABLE "DeviceHealthPing" ADD COLUMN IF NOT EXISTS "latitude"      DOUBLE PRECISION;
ALTER TABLE "DeviceHealthPing" ADD COLUMN IF NOT EXISTS "longitude"     DOUBLE PRECISION;
ALTER TABLE "DeviceHealthPing" ADD COLUMN IF NOT EXISTS "foregroundApp" TEXT;
