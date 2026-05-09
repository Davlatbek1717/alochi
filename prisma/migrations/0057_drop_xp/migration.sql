-- Migration 0057: Drop XP — move streak/shield data to student_streak, then drop xp tables.
--
-- CRITICAL: student_xp holds streak columns (current_streak, longest_streak,
-- shield_count, last_activity) that the StreakService relies on. We copy them
-- to a new student_streak table before dropping student_xp.

-- 1. Create student_streak table (streak data lives here from now on).
CREATE TABLE IF NOT EXISTS student_streak (
  id             UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak INT         NOT NULL DEFAULT 0,
  longest_streak INT         NOT NULL DEFAULT 0,
  shield_count   INT         NOT NULL DEFAULT 0,
  last_activity  TIMESTAMP WITH TIME ZONE,
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_streak_student_id_idx ON student_streak (student_id);

-- 2. Migrate existing streak data from student_xp → student_streak.
--    Use ON CONFLICT DO NOTHING so re-running this migration is safe.
INSERT INTO student_streak (student_id, current_streak, longest_streak, shield_count, last_activity, updated_at)
SELECT
  student_id,
  COALESCE(current_streak, 0),
  COALESCE(longest_streak, 0),
  COALESCE(shield_count, 0),
  last_activity,
  COALESCE(updated_at, now())
FROM student_xp
ON CONFLICT (student_id) DO NOTHING;

-- 3. Remove xp_reward column from tasks if it exists.
ALTER TABLE tasks DROP COLUMN IF EXISTS xp_reward;

-- 4. Remove xp_reward column from daily_quests.
ALTER TABLE daily_quests DROP COLUMN IF EXISTS xp_reward;

-- 5. Drop XP event log and XP aggregate tables (CASCADE removes FK constraints).
DROP TABLE IF EXISTS xp_events CASCADE;
DROP TABLE IF EXISTS student_xp CASCADE;
