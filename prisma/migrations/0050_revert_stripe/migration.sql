-- Phase 2 Revert — Remove Stripe customer ID from tenant_subscriptions
-- Idempotent: tolerates the table not existing (fresh dev DB scenario).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_subscriptions'
  ) THEN
    ALTER TABLE "tenant_subscriptions" DROP COLUMN IF EXISTS "stripe_customer_id";
  END IF;
END $$;
