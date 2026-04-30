"""
Cold-start seeder for the churn classifier training set.

Usage:
    DATABASE_URL=postgresql://user:pass@host:5432/alochi \
        python apps/ml-service/scripts/seed_training_data.py

What it does:
  1. Connects to PostgreSQL (asyncpg) using DATABASE_URL.
  2. Ensures the `churn_training_data` table + index exist (idempotent).
  3. Selects students who have at least 30 days of recorded `analytics_events` activity
     (i.e. min(created_at) <= NOW() - 30 days), so we have a real history to learn from.
  4. For each qualifying student, computes the same feature snapshot vector that
     `apps/ml-service/features.py.FEATURE_COLUMNS` enumerates (today: 7 features —
     Phase 14 is scheduled to expand this to 9; this script will pick up extra
     columns automatically because it imports FEATURE_COLUMNS).
  5. Computes a binary label using a simple at-risk rule:
        label = 1 if (current_streak == 0 AND days_since_last_attendance > 7) else 0
  6. INSERTs all rows (>= 100 desired) into churn_training_data and prints a summary.

Notes:
  * This script is meant to be run ONCE to bootstrap a real model when production
    data first becomes available. It is idempotent at the schema level (CREATE IF
    NOT EXISTS) but will append rows on every run — wipe the table first if you
    want a fresh seed.
  * If fewer than 100 qualifying students exist, the script will still insert what
    it can and print a warning so the operator can decide whether to wait for more
    data before training.
  * Designed to be re-runnable on a populated DB. Without DB access this module
    only imports cleanly; nothing runs at import time.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Tuple

import asyncpg

# Allow `python apps/ml-service/scripts/seed_training_data.py` from repo root
# by adding the parent dir (apps/ml-service) to sys.path so we can import
# `features` (sibling module).
_HERE = Path(__file__).resolve().parent
_ML_ROOT = _HERE.parent
if str(_ML_ROOT) not in sys.path:
    sys.path.insert(0, str(_ML_ROOT))

from features import FEATURE_COLUMNS  # noqa: E402  (path-mangling above)


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS churn_training_data (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL,
  features REAL[] NOT NULL,
  label SMALLINT NOT NULL CHECK (label IN (0, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS churn_training_data_label_idx
  ON churn_training_data(label);
"""


# Per-student feature + label query.
# Mirrors apps/ml-service/db.py snapshot logic but anchored at NOW() (not NOW()-60d)
# because we are seeding *current* state, then labelling with the at-risk rule.
SELECT_SAMPLES_SQL = """
WITH eligible AS (
  -- students with >= 30 days of analytics activity
  SELECT
    e.student_id AS id,
    MIN(e.created_at) AS first_event_at,
    MAX(e.created_at) AS last_event_at
  FROM analytics_events e
  WHERE e.student_id IS NOT NULL
  GROUP BY e.student_id
  HAVING MIN(e.created_at) <= NOW() - INTERVAL '30 days'
),
features AS (
  SELECT
    s.id AS student_id,
    COALESCE((SELECT COUNT(DISTINCT (a.created_at::date))
              FROM attendance_students a
              WHERE a.student_id = s.id
                AND a.is_present = false
                AND a.created_at >= NOW() - INTERVAL '30 days'), 0) AS absent_days_30d,
    COALESCE((SELECT current_streak FROM student_xp WHERE student_id = s.id), 0) AS streak_value,
    COALESCE((SELECT COUNT(*)
              FROM analytics_events e
              WHERE e.student_id = s.id
                AND e.event_type = 'lesson_completed'
                AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS lessons_completed_30d,
    COALESCE((SELECT COUNT(*)
              FROM analytics_events e
              WHERE e.student_id = s.id
                AND e.event_type = 'lesson_failed'
                AND e.created_at >= NOW() - INTERVAL '30 days'), 0) AS lessons_failed_30d,
    CASE WHEN EXISTS (
      SELECT 1 FROM student_status ss
      WHERE ss.student_id = s.id AND ss.english_status = 'qizil'
    ) THEN 1 ELSE 0 END AS has_red_status,
    CASE WHEN (SELECT parent_telegram_id FROM users WHERE id = s.id) IS NOT NULL
         THEN 1 ELSE 0 END AS has_parent_tg
  FROM eligible s
),
last_attendance AS (
  SELECT
    a.student_id,
    MAX(a.created_at) AS last_attended_at
  FROM attendance_students a
  WHERE a.is_present = true
  GROUP BY a.student_id
)
SELECT
  f.student_id::text AS student_id,
  f.absent_days_30d,
  f.streak_value,
  f.lessons_completed_30d,
  f.lessons_failed_30d,
  f.has_red_status,
  f.has_parent_tg,
  CASE WHEN (f.lessons_completed_30d + f.lessons_failed_30d) > 0
       THEN ROUND((f.lessons_completed_30d * 100.0)
                  / (f.lessons_completed_30d + f.lessons_failed_30d), 2)
       ELSE 0 END AS pass_rate_30d,
  COALESCE(EXTRACT(DAY FROM (NOW() - la.last_attended_at))::int, 9999) AS days_since_last_attendance
FROM features f
LEFT JOIN last_attendance la ON la.student_id = f.student_id
"""


def _row_to_features_and_label(row: asyncpg.Record) -> Tuple[List[float], int]:
    """Map a query row to (feature_vector, label). Picks columns by FEATURE_COLUMNS
    so adding more features later (Phase 14 — 9 features) is automatic, as long as
    they are also produced by SELECT_SAMPLES_SQL."""
    vec: List[float] = []
    for col in FEATURE_COLUMNS:
        if col not in row:
            # Future feature not yet wired into this query — default to 0.0 to
            # avoid blocking a partial cold-start seed.
            vec.append(0.0)
        else:
            vec.append(float(row[col]))

    streak = int(row["streak_value"])
    days_since = int(row["days_since_last_attendance"])
    label = 1 if (streak == 0 and days_since > 7) else 0
    return vec, label


async def _seed() -> int:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL env var is required.", file=sys.stderr)
        return 2

    conn = await asyncpg.connect(dsn)
    try:
        # 1) Idempotent schema. asyncpg.execute does not multiplex statements,
        # so split on the trailing ; for the two DDL statements.
        for stmt in filter(None, (s.strip() for s in CREATE_TABLE_SQL.split(";"))):
            await conn.execute(stmt)

        # 2) Pull samples
        rows = await conn.fetch(SELECT_SAMPLES_SQL)
        if not rows:
            print("WARN: no eligible students found (need >= 30 days of analytics_events).")
            return 0

        prepared: List[Tuple[str, List[float], int]] = []
        for r in rows:
            vec, label = _row_to_features_and_label(r)
            prepared.append((r["student_id"], vec, label))

        # 3) Bulk insert
        await conn.executemany(
            "INSERT INTO churn_training_data (student_id, features, label) "
            "VALUES ($1::uuid, $2::real[], $3::smallint)",
            prepared,
        )

        positives = sum(1 for _, _, lab in prepared if lab == 1)
        negatives = len(prepared) - positives
        print(f"Inserted {len(prepared)} rows into churn_training_data.")
        print(f"  Positive (at-risk) samples: {positives}")
        print(f"  Negative samples:           {negatives}")
        if len(prepared) < 100:
            print(
                "WARN: fewer than 100 samples — train with caution or wait for "
                "more activity before fitting a model."
            )
        return 0
    finally:
        await conn.close()


def main() -> int:
    return asyncio.run(_seed())


if __name__ == "__main__":
    raise SystemExit(main())
