-- Phase 2 Revert — Remove Stripe customer ID from tenant_subscriptions
ALTER TABLE "tenant_subscriptions"
  DROP COLUMN IF EXISTS "stripe_customer_id";
