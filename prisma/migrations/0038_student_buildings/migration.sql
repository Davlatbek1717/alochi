-- Phase 27 — per-lesson Virtual City building rows.
-- Each home-completed lesson (or mentor-approved academy completion) adds
-- exactly one StudentBuilding to the student's city. The (student_id,
-- lesson_id) pair is unique so retries are idempotent.

CREATE TABLE IF NOT EXISTS "student_buildings" (
  "id"          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "student_id"  UUID NOT NULL,
  "type"        TEXT NOT NULL,
  "tier"        INTEGER NOT NULL,
  "index"       INTEGER NOT NULL,
  "lesson_id"   UUID,
  "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "student_buildings_student_id_idx"
  ON "student_buildings" ("student_id");

-- Idempotency: at most one building per (student, lesson). lesson_id is
-- nullable so backfill can record pre-existing buildings without a
-- specific lesson reference if needed.
CREATE UNIQUE INDEX IF NOT EXISTS "student_buildings_student_id_lesson_id_key"
  ON "student_buildings" ("student_id", "lesson_id");

-- Backfill: for every student who already has finished lessons (home or
-- academy), retroactively insert one row per finished lesson in the order
-- they were completed. Tier and type follow the same rotation pool used
-- in city.service.addBuildingForLesson() so the rebuilt city looks
-- identical to one built incrementally going forward.
INSERT INTO "student_buildings" (
  "id", "student_id", "type", "tier", "index", "lesson_id", "unlocked_at"
)
SELECT
  uuid_generate_v4() AS id,
  ranked.student_id,
  CASE ranked.tier
    WHEN 1 THEN (ARRAY['house','road','tree','well','fence'])[((ranked.tier_pos - 1) % 5) + 1]
    WHEN 2 THEN (ARRAY['school','shop','park','bus_stop','garden'])[((ranked.tier_pos - 1) % 5) + 1]
    WHEN 3 THEN (ARRAY['library','theatre','fountain','hospital','square'])[((ranked.tier_pos - 1) % 5) + 1]
    WHEN 4 THEN (ARRAY['airport','university','tower','stadium','museum'])[((ranked.tier_pos - 1) % 5) + 1]
    ELSE       (ARRAY['skyscraper','monorail','planetarium','cathedral','satellite_dish'])[((ranked.tier_pos - 1) % 5) + 1]
  END AS type,
  ranked.tier,
  ranked.rn - 1 AS index,
  ranked.lesson_id,
  ranked.completed_at
FROM (
  SELECT
    sp.student_id,
    sp.lesson_id,
    COALESCE(sp.completed_at, sp.last_activity_at, now()) AS completed_at,
    ROW_NUMBER() OVER (
      PARTITION BY sp.student_id
      ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
    ) AS rn,
    CASE
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 1 AND 50 THEN 1
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 51 AND 150 THEN 2
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 151 AND 300 THEN 3
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 301 AND 500 THEN 4
      ELSE 5
    END AS tier,
    CASE
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 1 AND 50 THEN
        ROW_NUMBER() OVER (
          PARTITION BY sp.student_id
          ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
        )
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 51 AND 150 THEN
        ROW_NUMBER() OVER (
          PARTITION BY sp.student_id
          ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
        ) - 50
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 151 AND 300 THEN
        ROW_NUMBER() OVER (
          PARTITION BY sp.student_id
          ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
        ) - 150
      WHEN ROW_NUMBER() OVER (
        PARTITION BY sp.student_id
        ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
      ) BETWEEN 301 AND 500 THEN
        ROW_NUMBER() OVER (
          PARTITION BY sp.student_id
          ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
        ) - 300
      ELSE
        ROW_NUMBER() OVER (
          PARTITION BY sp.student_id
          ORDER BY COALESCE(sp.completed_at, sp.last_activity_at, now()), sp.lesson_id
        ) - 500
    END AS tier_pos
  FROM "student_progress" sp
  WHERE sp.home_completed = true OR sp.academy_completed = true
) ranked
ON CONFLICT ("student_id", "lesson_id") DO NOTHING;
