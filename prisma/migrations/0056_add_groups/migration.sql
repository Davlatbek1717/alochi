-- CreateTable groups
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name        text NOT NULL,
  mentor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

CREATE INDEX ON groups (tenant_id, branch_id);

-- Backfill: every distinct group_id currently used in users becomes
-- a Group row. Rows with no branch are skipped (orphaned group IDs).
-- Mentor is the first mentor-role user who already has that group_id.
INSERT INTO groups (id, tenant_id, branch_id, name, mentor_id)
SELECT
  gid,
  (SELECT tenant_id FROM users WHERE group_id = gid LIMIT 1) AS tenant_id,
  (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1) AS branch_id,
  'Guruh ' || ROW_NUMBER() OVER (
    PARTITION BY (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1)
    ORDER BY gid
  ) AS name,
  (SELECT id FROM users WHERE group_id = gid AND role = 'mentor' LIMIT 1) AS mentor_id
FROM (SELECT DISTINCT group_id AS gid FROM users WHERE group_id IS NOT NULL) g
WHERE (SELECT branch_id FROM users WHERE group_id = gid AND branch_id IS NOT NULL LIMIT 1) IS NOT NULL;
