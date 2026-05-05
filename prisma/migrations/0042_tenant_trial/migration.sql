-- Phase 30 — Tenant trial period
-- New self-registered tenants get a 14-day trial. After expiry the
-- bootstrap check can gate API access until a subscription is active.
-- Column is nullable so existing tenants (created before this change)
-- are treated as paid/grandfathered.

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
