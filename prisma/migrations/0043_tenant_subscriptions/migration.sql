-- Phase 31 — B2B tenant subscription tracking
-- Tracks the subscription plan, status and billing period for each
-- tenant. Gateways (Stripe, Payme, Click) update this table via webhooks.
-- Manual plan is used for early customers managed outside a payment gateway.

CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
  "id"                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "tenant_id"                UUID NOT NULL UNIQUE REFERENCES "tenants"("id") ON DELETE CASCADE,
  "plan"                     TEXT NOT NULL DEFAULT 'starter',
  "status"                   TEXT NOT NULL DEFAULT 'trialing',
  "gateway"                  TEXT,
  "gateway_subscription_id"  TEXT UNIQUE,
  "current_period_start"     TIMESTAMP(3),
  "current_period_end"       TIMESTAMP(3),
  "cancel_at_period_end"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tenant_subscriptions_status_idx"
  ON "tenant_subscriptions" ("status");
