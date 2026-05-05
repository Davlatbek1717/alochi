-- Phase 29 — Lesson template library
-- Superadmin can mark lessons as templates (is_template = true).
-- Filadmins can browse template lessons and deep-copy them into their
-- own tenant, giving every new markaz a ready-made starter curriculum
-- without exposing any other tenant's private lessons.

ALTER TABLE "lessons"
  ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN NOT NULL DEFAULT false;

-- Index so /lessons/templates can be served cheaply even as the
-- lessons table grows into the millions.
CREATE INDEX IF NOT EXISTS "lessons_is_template_idx"
  ON "lessons" ("is_template")
  WHERE "is_template" = true;
