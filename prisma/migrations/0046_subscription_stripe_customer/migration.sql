-- Phase 34 — Stripe Customer ID on TenantSubscription
-- Required for creating Stripe Customer Portal sessions.
-- Nullable because tenants without Stripe subscriptions don't have one.

ALTER TABLE "tenant_subscriptions"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT UNIQUE;
