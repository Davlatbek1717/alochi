# Phase 7b — Stripe Payment Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Stripe Checkout + Customer Portal into Adouptivo so filadmins can subscribe to a plan, Stripe webhooks auto-activate/deactivate tenants, and trial expiry triggers grace-period Telegram alerts then a hard block.

**Architecture:** The existing `SubscriptionsService`, `WebhooksController`, and `/filadmin/billing` page are scaffolded but have placeholder HMAC verification and no real Stripe SDK calls. This plan fills those gaps: installs the `stripe` npm package, adds `stripeCustomerId` to the schema, implements two new endpoints (`/subscriptions/checkout` and `/subscriptions/portal`), wires real webhook HMAC verification via `express.raw()`, and extends the 02:00 cron to send Telegram grace-period alerts.

**Tech Stack:** NestJS 10, `stripe` v17, Prisma 5, Next.js 15, Telegram bot (grammY), PostgreSQL

---

## File Map

| File | Change |
|---|---|
| `apps/api/package.json` | add `stripe` dependency |
| `prisma/schema.prisma` | add `stripeCustomerId` to TenantSubscription |
| `prisma/migrations/0046_subscription_stripe_customer/migration.sql` | CREATE column |
| `apps/api/src/main.ts` | `express.raw()` before json() for `/webhooks/stripe` |
| `apps/api/src/subscriptions/subscriptions.service.ts` | `createCheckoutSession`, `createPortalSession`, `saveStripeCustomerId` |
| `apps/api/src/subscriptions/subscriptions.controller.ts` | `POST /subscriptions/checkout`, `POST /subscriptions/portal` |
| `apps/api/src/subscriptions/webhooks.controller.ts` | real HMAC via `stripe.webhooks.constructEvent` |
| `apps/api/src/subscriptions/subscriptions.module.ts` | add `ConfigModule` |
| `apps/api/src/cron/cron.service.ts` | extend `checkTrialExpiries` with grace-period alerts |
| `apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx` | Checkout button (3 plans), Portal button |

---

## Task 1: Install Stripe SDK + add stripeCustomerId to schema

**Files:**
- Modify: `apps/api/package.json` (via pnpm)
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0046_subscription_stripe_customer/migration.sql`

- [ ] **Step 1: Install stripe package**

```bash
pnpm --filter api add stripe
```

Expected: `stripe` appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Add `stripeCustomerId` to `TenantSubscription` in `prisma/schema.prisma`**

Find the `TenantSubscription` model (around line 59). Add this field after `gatewaySubscriptionId`:

```prisma
  stripeCustomerId     String?  @unique @map("stripe_customer_id")
```

- [ ] **Step 3: Create migration file**

Create directory `prisma/migrations/0046_subscription_stripe_customer/` and file `migration.sql`:

```sql
-- Phase 34 — Stripe Customer ID on TenantSubscription
-- Required for creating Stripe Customer Portal sessions.
-- Nullable because tenants without Stripe subscriptions don't have one.

ALTER TABLE "tenant_subscriptions"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT UNIQUE;
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate --schema=prisma/schema.prisma
```

Expected: `@prisma/client` regenerated; `TenantSubscription` type includes `stripeCustomerId`.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml prisma/schema.prisma "prisma/migrations/0046_subscription_stripe_customer/"
git commit -m "feat(stripe): install stripe SDK + add stripeCustomerId to TenantSubscription"
```

---

## Task 2: Raw body middleware for Stripe webhooks

**Files:**
- Modify: `apps/api/src/main.ts`

Stripe HMAC signature verification requires the **raw, unparsed** request body. NestJS applies `json()` middleware globally, which destroys the raw body before it reaches the webhook controller. We register `express.raw()` specifically for `/webhooks/stripe` **before** the global `json()`.

- [ ] **Step 1: Read `apps/api/src/main.ts`**

Confirm the file imports `json, urlencoded` from `express` and calls `app.use(json(...))` and `app.use(urlencoded(...))`.

- [ ] **Step 2: Add raw body handler before json middleware**

In `apps/api/src/main.ts`, after `app.use(helmet())` and before `app.use(json(...))`, insert:

```typescript
// Raw body is required by Stripe webhook HMAC verification.
// Must be registered BEFORE the global json() parser so that
// /webhooks/stripe receives the original Buffer, not a parsed object.
app.use(
  '/webhooks/stripe',
  (await import('express')).default.raw({ type: 'application/json' }),
);
```

> Note: The dynamic import avoids a circular dependency with the already-imported `json` from `express`. Alternatively, import `raw` at the top alongside `json`:

Add `raw` to the existing express import at the top of the file:

```typescript
import { json, urlencoded, raw } from 'express';
```

Then before `app.use(json(...))`:

```typescript
// Stripe webhooks need the raw Buffer — register before json() parser.
app.use('/webhooks/stripe', raw({ type: 'application/json' }));
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(stripe): register express.raw() for /webhooks/stripe before global json parser"
```

---

## Task 3: SubscriptionsService — Stripe checkout + portal methods

**Files:**
- Modify: `apps/api/src/subscriptions/subscriptions.service.ts`
- Modify: `apps/api/src/subscriptions/subscriptions.module.ts`

- [ ] **Step 1: Add ConfigModule to SubscriptionsModule**

Open `apps/api/src/subscriptions/subscriptions.module.ts`. The module currently imports only `PrismaModule`. Add `ConfigModule`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SubscriptionsController, WebhooksController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

- [ ] **Step 2: Add Stripe + ConfigService to SubscriptionsService**

Open `apps/api/src/subscriptions/subscriptions.service.ts`. Add imports and inject `ConfigService`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertSubscriptionDto {
  plan: string;
  status: string;
  gateway?: string;
  gatewaySubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_ID_STARTER,
  pro: process.env.STRIPE_PRICE_ID_PRO,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
};

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2025-04-30.basil',
    });
  }
  // ... existing methods stay unchanged below
```

- [ ] **Step 3: Add `saveStripeCustomerId` helper**

Add this private method to `SubscriptionsService` after the constructor:

```typescript
  /** Ensure a Stripe Customer exists for the tenant and cache the ID. */
  private async ensureStripeCustomer(tenantId: string): Promise<string> {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });

    if (sub?.stripeCustomerId) return sub.stripeCustomerId;

    // Look up tenant name for the Customer display label.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const customer = await this.stripe.customers.create({
      name: tenant?.name ?? tenantId,
      metadata: { tenantId },
    });

    // Persist the new customer ID so we don't create duplicates.
    await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: { tenantId, stripeCustomerId: customer.id, status: 'trialing', plan: 'starter' },
      update: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }
```

- [ ] **Step 4: Add `createCheckoutSession` method**

```typescript
  /**
   * Create a Stripe Checkout Session for a new or upgraded subscription.
   * Returns the hosted checkout URL; caller should redirect the browser there.
   */
  async createCheckoutSession(
    tenantId: string,
    plan: 'starter' | 'pro' | 'enterprise',
    returnBaseUrl: string,
  ): Promise<string> {
    const priceId = this.config.get<string>(`STRIPE_PRICE_ID_${plan.toUpperCase()}`);
    if (!priceId) {
      throw new BadRequestException(`Stripe Price ID for plan "${plan}" is not configured.`);
    }

    const customerId = await this.ensureStripeCustomer(tenantId);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { tenantId },
      },
      success_url: `${returnBaseUrl}/filadmin/billing?checkout=success`,
      cancel_url: `${returnBaseUrl}/filadmin/billing?checkout=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL.');
    return session.url;
  }
```

- [ ] **Step 5: Add `createPortalSession` method**

```typescript
  /**
   * Create a Stripe Billing Portal session so the filadmin can manage
   * their subscription (update payment method, cancel, view invoices).
   */
  async createPortalSession(tenantId: string, returnBaseUrl: string): Promise<string> {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      throw new BadRequestException('No Stripe customer found for this tenant. Subscribe first.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${returnBaseUrl}/filadmin/billing`,
    });

    return session.url;
  }
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/subscriptions/
git commit -m "feat(stripe): SubscriptionsService — ensureStripeCustomer, createCheckoutSession, createPortalSession"
```

---

## Task 4: SubscriptionsController — new checkout and portal endpoints

**Files:**
- Modify: `apps/api/src/subscriptions/subscriptions.controller.ts`

- [ ] **Step 1: Add `POST /subscriptions/checkout` endpoint**

Open `apps/api/src/subscriptions/subscriptions.controller.ts`. Add `Post, Body` to existing NestJS imports (they may already be there). Add the new endpoint after the existing `getMe()` method:

```typescript
  /**
   * POST /subscriptions/checkout
   * Filadmin initiates a new Stripe Checkout session for their tenant.
   * Returns { url } — frontend should redirect window.location.href to it.
   */
  @Post('checkout')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async checkout(
    @Body('plan') plan: 'starter' | 'pro' | 'enterprise',
    @Request() req: any,
  ) {
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      throw new BadRequestException('Invalid plan. Must be starter, pro, or enterprise.');
    }
    const returnBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
    const url = await this.svc.createCheckoutSession(req.user.tenantId, plan, returnBaseUrl);
    return { url };
  }

  /**
   * POST /subscriptions/portal
   * Returns a Stripe Customer Portal URL so filadmin can manage their
   * subscription (update card, cancel, view invoices).
   */
  @Post('portal')
  @Roles(UserRole.filadmin, UserRole.superadmin)
  async portal(@Request() req: any) {
    const returnBaseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'http://localhost:3000';
    const url = await this.svc.createPortalSession(req.user.tenantId, returnBaseUrl);
    return { url };
  }
```

Also add `BadRequestException` to the NestJS import at the top:
```typescript
import { ..., BadRequestException } from '@nestjs/common';
```

And add `NEXT_PUBLIC_FRONTEND_URL` to `.env.example`:
```
# Public URL of the frontend (used to build Stripe redirect URLs)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/subscriptions/subscriptions.controller.ts .env.example
git commit -m "feat(stripe): POST /subscriptions/checkout and /subscriptions/portal endpoints"
```

---

## Task 5: Real Stripe HMAC webhook verification

**Files:**
- Modify: `apps/api/src/subscriptions/webhooks.controller.ts`

The existing webhook handler has `// TODO: verify HMAC`. Replace that placeholder with real `stripe.webhooks.constructEvent()` verification.

- [ ] **Step 1: Inject Stripe instance in WebhooksController**

Open `apps/api/src/subscriptions/webhooks.controller.ts`. The controller currently uses `ConfigService`. Add `Stripe` SDK:

```typescript
import Stripe from 'stripe';
```

In the constructor, initialise a Stripe client:

```typescript
  private stripe: Stripe;

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2025-04-30.basil',
    });
  }
```

- [ ] **Step 2: Replace HMAC TODO with real verification**

Replace the entire `stripeWebhook` method body with:

```typescript
  @Post('stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — rejecting webhook in production');
      if (this.config.get('NODE_ENV') === 'production') {
        throw new BadRequestException('Webhook secret not configured');
      }
    }

    let event: Stripe.Event;
    try {
      // req.body is a Buffer here because express.raw() is registered in main.ts
      // for this route before the global json() parser.
      event = this.stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret ?? '',
      );
    } catch (err) {
      this.logger.warn(`stripe.webhook.signature_invalid: ${(err as Error).message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    this.logger.log(`stripe.webhook type=${event.type}`);

    try {
      await this.handleStripeEvent(event);
    } catch (err) {
      this.logger.error(`stripe.webhook.handler_error type=${event.type}: ${(err as Error).message}`);
      // Return 200 to Stripe even on handler errors so it doesn't retry
      // indefinitely — log and investigate separately.
    }

    return { received: true };
  }

  private async handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'invoice.payment_succeeded': {
        const obj = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const sub = 'subscription' in obj
          ? await this.stripe.subscriptions.retrieve(obj.subscription as string)
          : obj as Stripe.Subscription;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) { this.logger.warn('stripe.webhook: no tenantId in metadata'); return; }
        const plan = (sub.items.data[0]?.price.lookup_key ?? 'starter') as string;
        const periodEnd = new Date((sub.current_period_end ?? 0) * 1000);
        await this.subs.activate(tenantId, plan, 'stripe', periodEnd, sub.id);
        this.logger.log(`stripe.webhook: activated tenant=${tenantId} plan=${plan}`);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;
        await this.subs.upsert(tenantId, {
          plan: (sub.items.data[0]?.price.lookup_key ?? 'starter') as string,
          status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'trialing',
          gatewaySubscriptionId: sub.id,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const subId = inv.subscription as string | null;
        if (!subId) return;
        const sub = await this.stripe.subscriptions.retrieve(subId);
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;
        await this.subs.markPastDue(tenantId);
        this.logger.log(`stripe.webhook: past_due tenant=${tenantId}`);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const tenantId = sub.metadata?.tenantId;
        if (!tenantId) return;
        await this.subs.cancel(tenantId, true);
        this.logger.log(`stripe.webhook: canceled tenant=${tenantId}`);
        break;
      }
      default:
        this.logger.debug(`stripe.webhook: unhandled event type=${event.type}`);
    }
  }
```

Also add `BadRequestException` import from `@nestjs/common`.

- [ ] **Step 3: Remove the old Payme/Click scaffolds (they're deferred)**

The existing Payme and Click handlers have `// TODO: verify HMAC` and are non-functional. Comment them out cleanly to avoid confusion — they'll be re-enabled in a future sprint when merchant accounts are available:

At the top of each handler method (`@Post('payme')` and `@Post('click')`), add:

```typescript
  @Post('payme')
  @HttpCode(200)
  async paymeWebhook() {
    // Payme integration deferred — merchant account not yet configured.
    // Will be implemented in Phase 7c.
    return { result: null, error: { code: -32300, message: 'Not available yet' } };
  }

  @Post('click')
  @HttpCode(200)
  async clickWebhook() {
    // Click integration deferred — merchant account not yet configured.
    // Will be implemented in Phase 7c.
    return { error: -9000, error_note: 'Not available yet' };
  }
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter api exec jest
```

Expected: 411/411 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/subscriptions/webhooks.controller.ts
git commit -m "feat(stripe): real HMAC webhook verification via stripe.webhooks.constructEvent + handle 5 event types"
```

---

## Task 6: Cron — grace period Telegram alerts

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`

The existing `checkTrialExpiries()` cron hard-blocks tenants when `trialEndsAt < now`. We extend it to:
1. Send a Telegram alert 3 days before expiry
2. Send an urgent alert 1 day before expiry
3. Block and notify after expiry (existing behavior, now with Telegram message)

The cron service already imports `TelegramService`. Find the `checkTrialExpiries` method (around line 615).

- [ ] **Step 1: Find the superadmin's Telegram ID**

The cron needs to message the tenant's filadmin (or superadmin). The `TelegramService.sendMessage()` takes a telegramId. We need to find the filadmin for each expiring tenant.

Look at how other cron methods find users to message (e.g. the existing Telegram notification code around line 136). Follow the same pattern.

- [ ] **Step 2: Replace `checkTrialExpiries` with the extended version**

Find the existing `@Cron('0 2 * * *', { name: 'trial_expiry_check' })` and replace the entire method:

```typescript
  @Cron('0 2 * * *', { name: 'trial_expiry_check' })
  async checkTrialExpiries() {
    this.logger.log('Cron: trial_expiry_check.start');
    const now = new Date();

    try {
      // ── 3-day warning ────────────────────────────────────────────────────
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const soonExpiring = await this.prisma.tenant.findMany({
        where: {
          trialEndsAt: { gt: now, lte: threeDaysFromNow },
          isActive: true,
          subscription: { is: null },  // no subscription at all
        },
        select: {
          id: true,
          name: true,
          trialEndsAt: true,
          users: {
            where: { role: 'filadmin', status: 'active', telegramId: { not: null } },
            select: { telegramId: true },
            take: 1,
          },
        },
      });

      for (const tenant of soonExpiring) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        const daysLeft = Math.ceil(
          ((tenant.trialEndsAt?.getTime() ?? 0) - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `⚠️ <b>${tenant.name}</b>: sinov davri ${daysLeft} kunda tugaydi.\n\nObunani boshlash uchun: <b>Filadmin paneli → Billing</b>`,
          );
        } catch { /* Telegram send failure must not block the loop */ }
      }

      // ── 1-day urgent warning ─────────────────────────────────────────────
      const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
      const urgentExpiring = await this.prisma.tenant.findMany({
        where: {
          trialEndsAt: { gt: now, lte: oneDayFromNow },
          isActive: true,
          subscription: { is: null },
        },
        select: {
          id: true,
          name: true,
          users: {
            where: { role: 'filadmin', status: 'active', telegramId: { not: null } },
            select: { telegramId: true },
            take: 1,
          },
        },
      });

      for (const tenant of urgentExpiring) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `🚨 <b>${tenant.name}</b>: Ertaga sinov davri tugaydi va kirish bloklanadi!\n\nHoziroq obuna qiling: <b>Filadmin paneli → Billing</b>`,
          );
        } catch { /* ignore */ }
      }

      // ── Hard block expired tenants ────────────────────────────────────────
      const result = await this.prisma.tenant.updateMany({
        where: {
          trialEndsAt: { lt: now },
          isActive: true,
          subscription: {
            OR: [{ is: null }, { status: { in: ['trialing', 'past_due', 'canceled'] } }],
          },
        },
        data: { isActive: false },
      });

      if (result.count === 0) {
        this.logger.log('trial_expiry_check.done expired=0');
        return;
      }

      // Notify blocked tenants
      const blockedTenants = await this.prisma.tenant.findMany({
        where: {
          trialEndsAt: { lt: now },
          isActive: false,
        },
        select: {
          id: true,
          name: true,
          users: {
            where: { role: 'filadmin', status: 'active', telegramId: { not: null } },
            select: { telegramId: true },
            take: 1,
          },
        },
        take: 50,
      });

      for (const tenant of blockedTenants) {
        const filadmin = tenant.users[0];
        if (!filadmin?.telegramId) continue;
        try {
          await this.telegram.sendMessage(
            filadmin.telegramId,
            `🔒 <b>${tenant.name}</b>: Sinov davri tugadi va kirish bloklanadi.\n\nObuna qilish uchun: <b>Filadmin paneli → Billing</b>`,
          );
        } catch { /* ignore */ }
      }

      this.logger.log(`trial_expiry_check.done expired=${result.count}`);
    } catch (err) {
      this.logger.error(`trial_expiry_check.failed: ${(err as Error).message}`);
    }
  }
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter api exec jest --testPathPattern="cron"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cron/cron.service.ts
git commit -m "feat(stripe): cron trial expiry — 3-day + 1-day Telegram alerts + hard block on expiry"
```

---

## Task 7: `/filadmin/billing` UI — Checkout buttons + Portal button

**Files:**
- Modify: `apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx`

The existing billing page shows placeholder "Tez kunda" buttons. We replace them with real API calls.

- [ ] **Step 1: Read the existing billing page**

Open `apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx` and understand the current structure.

- [ ] **Step 2: Add plan selection state and redirect logic**

Add to the component (inside `export default function BillingPage()`):

```typescript
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function startCheckout(plan: 'starter' | 'pro' | 'enterprise') {
    setCheckoutLoading(plan);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ url: string }>(
        '/subscriptions/checkout',
        { method: 'POST', body: JSON.stringify({ plan }) },
        token,
      );
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ url: string }>(
        '/subscriptions/portal',
        { method: 'POST' },
        token,
      );
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setPortalLoading(false);
    }
  }
```

Add `useState` to the existing `react` import and `useToast` from `@/components/ui` if not already there.

- [ ] **Step 3: Replace the placeholder "Tez kunda" section with real plan cards**

Find the section in the JSX that renders "Tez kunda" badges and the placeholder Payme/Click/Stripe cards. Replace it with:

```tsx
{/* Plan selection — only show when no active subscription */}
{(!subscription || ['trialing', 'past_due', 'canceled'].includes(subscription.status)) && (
  <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
    <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-4">
      Obuna tanlang
    </p>
    <div className="grid sm:grid-cols-3 gap-3">
      {([
        { plan: 'starter', label: 'Starter', price: '$160/oy', desc: '≤50 o\'quvchi, 1 filial' },
        { plan: 'pro',     label: 'Pro ⭐',   price: '$400/oy', desc: '≤200 o\'quvchi, 3 filial' },
        { plan: 'enterprise', label: 'Enterprise', price: 'Kelishuv', desc: 'Cheksiz' },
      ] as const).map(({ plan, label, price, desc }) => (
        <button
          key={plan}
          type="button"
          onClick={() => startCheckout(plan)}
          disabled={checkoutLoading !== null}
          className="flex flex-col items-start gap-1 p-4 rounded-xl border-2 border-[#ede9e1] hover:border-[#6d28d9] hover:bg-[#fffaf0] transition-colors text-left disabled:opacity-50"
        >
          <span className="text-sm font-extrabold text-[#0f172a]">{label}</span>
          <span className="text-lg font-black text-[#6d28d9]">{price}</span>
          <span className="text-xs text-[#64748b] font-semibold">{desc}</span>
          {checkoutLoading === plan && (
            <Loader2 size={14} className="animate-spin text-[#6d28d9] mt-1" />
          )}
        </button>
      ))}
    </div>
  </div>
)}

{/* Billing portal — only when Stripe subscription exists */}
{subscription?.gateway === 'stripe' && subscription.status === 'active' && (
  <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 flex items-center justify-between">
    <div>
      <p className="text-sm font-extrabold text-[#0f172a]">Billing boshqaruvi</p>
      <p className="text-xs text-[#64748b] font-semibold mt-0.5">
        Karta yangilash, bekor qilish, invoice ko'rish
      </p>
    </div>
    <button
      type="button"
      onClick={openPortal}
      disabled={portalLoading}
      className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
    >
      {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
      Stripe portalga o'tish
    </button>
  </div>
)}
```

Also add a success/cancel banner when redirected back from Stripe:

```tsx
{/* Stripe redirect banners */}
{searchParams.get('checkout') === 'success' && (
  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
    <CheckCircle size={16} />
    To'lov muvaffaqiyatli! Obuna faollashtirildi.
  </div>
)}
{searchParams.get('checkout') === 'cancel' && (
  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm font-semibold">
    To'lov bekor qilindi. Xohlasangiz yana urinib ko'ring.
  </div>
)}
```

For `searchParams`, add to the component:

```typescript
import { useSearchParams } from 'next/navigation';
// inside component:
const searchParams = useSearchParams();
```

- [ ] **Step 4: Add `useToast` import**

```typescript
import { useToast } from '@/components/ui';
// inside component:
const toast = useToast();
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Full quality gates**

```bash
pnpm --filter api exec jest
pnpm run build
```

Expected: 411/411 tests pass. Build clean.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx"
git commit -m "feat(stripe): billing UI — 3-plan checkout buttons, Stripe portal redirect, success/cancel banners"
```

---

## Task 8: Final integration commit

- [ ] **Step 1: Verify all quality gates**

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec jest
pnpm run build
```

Expected: 0 type errors, 411/411 tests, build clean.

- [ ] **Step 2: Verify webhook flow with Stripe CLI (manual test)**

Install Stripe CLI locally if not installed: https://stripe.com/docs/stripe-cli

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Copy the `whsec_...` secret shown in the output. Add it to `apps/api/.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

In another terminal, trigger a test event:
```bash
stripe trigger invoice.payment_succeeded
```

Expected in API logs:
```
stripe.webhook type=invoice.payment_succeeded
stripe.webhook: activated tenant=... plan=...
```

- [ ] **Step 3: Final commit**

```bash
git add .env.example
git commit -m "docs(stripe): add NEXT_PUBLIC_FRONTEND_URL to .env.example"
```

---

## Self-Review ✅

**Spec coverage:**
- [x] Stripe SDK installed — Task 1
- [x] `stripeCustomerId` schema + migration — Task 1
- [x] Raw body middleware for HMAC — Task 2
- [x] `createCheckoutSession` — Task 3
- [x] `createPortalSession` — Task 3
- [x] `POST /subscriptions/checkout` — Task 4
- [x] `POST /subscriptions/portal` — Task 4
- [x] Real HMAC webhook via `stripe.webhooks.constructEvent` — Task 5
- [x] 5 Stripe event types handled — Task 5
- [x] Payme/Click deferred cleanly — Task 5
- [x] 3-day + 1-day Telegram alerts — Task 6
- [x] Hard block on trial expiry — Task 6 (extended existing)
- [x] 3-plan checkout buttons UI — Task 7
- [x] Portal button UI — Task 7
- [x] Success/cancel redirect banners — Task 7
- [x] Stripe CLI test verification — Task 8

**Placeholder scan:** None found. ✅

**Type consistency:**
- `createCheckoutSession(tenantId, plan, returnBaseUrl)` — same signature in service and controller ✅
- `createPortalSession(tenantId, returnBaseUrl)` — same ✅
- `activate(tenantId, plan, gateway, periodEnd, subId?)` — matches existing `SubscriptionsService.activate` signature ✅
