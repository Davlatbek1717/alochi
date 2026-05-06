# Phase 7b — Stripe Payment Integration Dizayni

**Sana:** 2026-05-05
**Muallif:** Davlatbek + Claude
**Holat:** Tasdiqlangan ✅

---

## Maqsad

Adouptivo platformasiga Stripe to'lov tizimini qo'shish — markaz egalari (filadmin) 3 ta plan orasidan birini tanlaydi, Stripe Checkout orqali to'laydi, webhook avtomatik aktivlashtiradi. Trial tugaganda grace period + Telegram eslatma, keyin blok.

---

## Texnik Stack

- `stripe` npm paketi (server side only)
- NestJS Webhook controller (raw body)
- Prisma `TenantSubscription` model (allaqachon bor, `stripeCustomerId` qo'shiladi)
- Cron job (kunlik 02:00)

---

## Arxitektura

```
[filadmin/billing]
  ├── "Obunani boshlash" (plan yo'q yoki expired)
  │     → POST /subscriptions/checkout
  │     → Stripe Checkout Session yaratiladi
  │     → Redirect: Stripe hosted payment page
  │     → Muvaffaqiyat → /filadmin/billing?success=1
  │
  └── "Billing boshqaruvi" (aktiv plan)
        → POST /subscriptions/portal
        → Stripe Customer Portal Session
        → Redirect: Stripe portal (karta yangilash, bekor qilish, invoice)
        → Qaytish → /filadmin/billing

[Stripe → Server]
  POST /webhooks/stripe
    ├── customer.subscription.created   → activate()
    ├── customer.subscription.updated   → upsert(status, period)
    ├── invoice.payment_succeeded       → activate()
    ├── invoice.payment_failed          → markPastDue()
    └── customer.subscription.deleted  → cancel()

[Cron — har kuni 02:00]
  checkTrialAndGrace()
    ├── trialEndsAt < now + 3 days → Telegram eslatma yuborish
    ├── trialEndsAt < now + 1 day  → Telegram urgent eslatma
    └── trialEndsAt < now AND no active subscription → isActive = false + Telegram xabar
```

---

## Schema O'zgarishlari

`TenantSubscription` modeliga qo'shimcha maydon:

```prisma
stripeCustomerId String? @map("stripe_customer_id") // Customer Portal uchun
```

Migration: `0046_subscription_stripe_customer`

---

## Stripe Narx Planlari

`.env` da 3 ta `Price ID`:

```env
STRIPE_PRICE_ID_STARTER=price_xxx   # $160/oy
STRIPE_PRICE_ID_PRO=price_xxx       # $400/oy
STRIPE_PRICE_ID_ENTERPRISE=price_xxx # enterprise (yashirin, manual)
```

Superadmin Stripe Dashboard'da yaratadi — siz bergan narxlar.

---

## Yangi Endpoint'lar

### `POST /subscriptions/checkout`
- Auth: filadmin yoki superadmin
- Body: `{ plan: 'starter' | 'pro' | 'enterprise' }`
- Flow:
  1. `stripeCustomerId` yo'q bo'lsa → `stripe.customers.create()` → saqlash
  2. `stripe.checkout.sessions.create()` — `subscription_data.trial_period_days: 0` (trial allaqachon o'tilgan bo'lsa)
  3. `{ url: checkoutUrl }` qaytaradi
- Frontend: `window.location.href = url`

### `POST /subscriptions/portal`
- Auth: filadmin
- Flow:
  1. `stripeCustomerId` yo'q → 404
  2. `stripe.billingPortal.sessions.create()`
  3. `{ url: portalUrl }` qaytaradi

### `POST /webhooks/stripe`
- **No auth, no JWT** — raw body kerak
- HMAC: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`
- Xatolik: 400 qaytaradi (Stripe retry qiladi)
- Raw body: express middleware `'/webhooks/stripe'` route uchun `express.raw()`

---

## Raw Body Muammosi

NestJS default'da `json()` middleware ishlatadi va body'ni parse qiladi. Stripe HMAC'i uchun **parse qilinmagan raw body** kerak. Yechim:

```ts
// main.ts
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
// Bu json() middleware'dan OLDIN yozilishi kerak
```

---

## Webhook Hodisalari

| Hodisa | Harakat |
|---|---|
| `customer.subscription.created` | `activate(tenantId, plan, 'stripe', periodEnd, subId)` |
| `customer.subscription.updated` | `upsert(...)` — status/period yangilash |
| `invoice.payment_succeeded` | `activate(...)` |
| `invoice.payment_failed` | `markPastDue(tenantId)` |
| `customer.subscription.deleted` | `cancel(tenantId)` |

Tenant ID webhook'da `metadata.tenantId` sifatida saqlanadi.

---

## Cron: Trial + Grace Period

```
Har kuni 02:00 → checkTrialAndGrace():

  1. trialEndsAt < now + 3 kun  → Telegram: "Sinov davri 3 kunda tugaydi"
  2. trialEndsAt < now + 1 kun  → Telegram: "Ertaga bloklanasiz. To'lov: /filadmin/billing"
  3. trialEndsAt < now AND subscription.status NOT IN ['active'] →
       tenant.isActive = false
       Telegram: "Sinov tugadi. To'lov amalga oshiring."
  4. subscription.status = 'past_due' + > 3 kun →
       tenant.isActive = false
       Telegram: "To'lov amalga oshirilmadi."
```

---

## `/filadmin/billing` UI O'zgarishlari

Hozirgi: placeholder "Tez kunda" ko'rsatadi.

Yangi holat:
1. **Trial davri** → "X kun qoldi" + "Obunani boshlash" tugmasi (3 plan)
2. **Aktiv obuna** → Plan nomi + "Billing boshqaruvi" (portal) tugmasi
3. **Past due** → Qizil ogohlantirish + "To'lov qilish" tugmasi
4. **Blok** → "Hisobingiz bloklanagan. To'lov qiling." full-screen banner

---

## Xavfsizlik

- Webhook endpoint HMAC'siz hech qanday tenant aktivlamaydi
- Stripe raw body faqat `/webhooks/stripe` uchun
- `stripeCustomerId` faqat server side
- Checkout URL frontend'ga beriladi — lekin JWT bilan himoyalangan endpoint

---

## Test Strategiyasi

- Stripe CLI: `stripe listen --forward-to localhost:3001/webhooks/stripe`
- Test karta: `4242 4242 4242 4242` (muvaffaqiyatli to'lov)
- Test karta: `4000 0000 0000 0341` (karta rad etiladi → payment_failed)
- STRIPE_WEBHOOK_SECRET: `stripe listen` buyrug'i bergan `whsec_...` kalitdan
