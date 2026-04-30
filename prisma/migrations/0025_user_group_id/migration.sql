-- Phase 10 — User.groupId
--
-- Adds a nullable `group_id` column to `users` so mentor-frontend pages can
-- fetch their group roster via GET /users/group/:groupId. The column is
-- indexed for cheap group-scoped queries; future phases will introduce the
-- canonical `groups` table and FK constraint.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "group_id" UUID;

CREATE INDEX IF NOT EXISTS "users_group_id_idx" ON "users" ("group_id");
