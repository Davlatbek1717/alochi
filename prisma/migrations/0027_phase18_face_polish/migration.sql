-- Phase 18: Face ID polish
-- Add per-record late_minutes (was just boolean is_late before).
ALTER TABLE attendance_staff
  ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0;
