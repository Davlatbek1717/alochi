-- Session engine: superadmin daily cap + hourly forced breaks.
-- Adds per-day session-state columns to study_time_daily.
ALTER TABLE "study_time_daily"
  ADD COLUMN "block_started_at" TIMESTAMP(3),
  ADD COLUMN "break_until"      TIMESTAMP(3),
  ADD COLUMN "cap_reached_at"   TIMESTAMP(3);
