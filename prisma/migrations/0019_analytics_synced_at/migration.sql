ALTER TABLE "analytics_events" ADD COLUMN "synced_at" TIMESTAMP(3);
CREATE INDEX "analytics_events_synced_at_idx" ON "analytics_events" ("synced_at") WHERE "synced_at" IS NULL;
