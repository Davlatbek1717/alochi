# A'lochi MVP ga Qaytarish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loyihani "Adouptivo / general-audience / multi-country" tomonga qilingan o'zgarishlardan tozalab, original A'lochi MVP holatiga qaytarish (Faza 1-4 spec, [docs/superpowers/specs/2026-04-23-alochi-platform-design.md](../specs/2026-04-23-alochi-platform-design.md)).

**Architecture:** 7 ta phase, har biri mustaqil commit. Har phase oxirida sacred quality bar (typecheck/lint/build/test). Phase tartibi: kichik va izolyatsiyalangandan kattaga (2FA → Stripe → i18n → branding → archive → pitch deck → final verification).

**Tech Stack:** NestJS 10, Next.js 15, Prisma 5, PostgreSQL, pnpm workspaces.

**Saqlanadi (MVP scope):** AI Tutor (Gemini), Azure Speech, MediaPipe, Telegram bot, gamification, Face ID, social features, adaptive learning, churn prediction, ClickHouse, PWA, AI Lesson Generator (Phase 14), multi-tenant onboarding (Faza 4 — local), manual to'lov (filadmin "to'lov qabul qilindi"), Migration 0047_performance_indexes.

**Olib tashlanadi (global push):** Brand `Adouptivo`, i18n (en/ru), Stripe, 2FA TOTP, multi-country pitch.

---

## Phase 0: Workspace Setup

**Files:**
- Create: yangi git branch `revert-to-alochi-mvp`
- Modify: working tree (uncommitted changes)

- [ ] **Step 1: Branch yaratish va checkpoint commit**

```powershell
cd d:\projects\alochi
git status --short
git checkout -b revert-to-alochi-mvp
git add -A
git commit -m "chore: pre-revert snapshot before A'lochi MVP rollback"
```

Expected: yangi branch `revert-to-alochi-mvp` ochilgan, hozirgi 21 modified fayl checkpoint commit'da. Hech qanday work yo'qolmaydi.

- [ ] **Step 2: Baseline quality gates ishga tushirish**

```powershell
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
```

Expected: hozirgi holatda ham PASS bo'lishi kerak. Agar FAIL bo'lsa, demak baseline allaqachon broken — keyingi qadamlardan oldin tuzatish kerak.

---

## Phase 1: 2FA TOTP — To'liq O'chirish

**Files:**
- Delete: `apps/api/src/auth/totp.service.ts`
- Delete: `apps/api/src/auth/totp.service.spec.ts`
- Delete: `apps/api/__mocks__/otplib.js` (agar mavjud bo'lsa)
- Delete: `apps/web/app/[locale]/(dashboard)/_components/TwoFactorSection.tsx`
- Modify: `apps/api/src/auth/auth.service.ts` — `setup2FA`, `enable2FA`, `disable2FA`, `verify2FA`, `regenerateBackupCodes` metodlari va login flow ichidagi 2fa branch (tempToken/`status: '2fa_required'`) o'chiriladi
- Modify: `apps/api/src/auth/auth.controller.ts` — 2FA endpoint'lari o'chiriladi (`/auth/2fa/setup`, `/auth/2fa/enable`, `/auth/2fa/disable`, `/auth/2fa/backup-codes/regenerate`, `/auth/verify-2fa`, admin reset)
- Modify: `apps/api/src/auth/auth.module.ts` — `TotpService` provider va dependency'lar o'chiriladi
- Modify: `apps/web/app/[locale]/(auth)/login/_components/LoginForm.tsx` — 2FA verification step UI o'chiriladi
- Modify: profil sahifasi (lokatsiyani Step 4 da topamiz) — `<TwoFactorSection />` o'chiriladi
- Modify: `prisma/schema.prisma` — User modelidan `totpSecret`, `totpEnabled`, `totpBackupCodes` o'chiriladi
- Modify: `apps/api/package.json` — `otplib` dep o'chiriladi
- Modify: `.env.example`, `apps/api/.env.example` — `TOTP_ENCRYPTION_KEY` o'chiriladi
- Create: `prisma/migrations/0049_revert_2fa/migration.sql` — `users` jadvalidan 3 ustun olib tashlash

- [ ] **Step 1: Backend service fayllarni o'chirish**

```powershell
Remove-Item "apps/api/src/auth/totp.service.ts" -Force
Remove-Item "apps/api/src/auth/totp.service.spec.ts" -Force
if (Test-Path "apps/api/__mocks__/otplib.js") { Remove-Item "apps/api/__mocks__/otplib.js" -Force }
```

- [ ] **Step 2: `auth.controller.ts` dan 2FA endpoint'larini olib tashlash**

`apps/api/src/auth/auth.controller.ts` ni o'qib, quyidagilarni topib o'chirish:
- `@Get('2fa/setup')`
- `@Post('2fa/enable')`
- `@Post('2fa/disable')`
- `@Post('2fa/backup-codes/regenerate')`
- `@Post('verify-2fa')`
- Filadmin/superadmin admin reset endpoint
- TotpService import + constructor inject

- [ ] **Step 3: `auth.service.ts` dan 2FA mantig'ini olib tashlash**

`apps/api/src/auth/auth.service.ts` da:
- `login()` metodida `if (user.totpEnabled) { return { status: '2fa_required', tempToken } }` branch o'chiriladi → har doim to'g'ridan-to'g'ri JWT qaytaradi
- `setup2FA`, `enable2FA`, `disable2FA`, `verify2FA`, `regenerateBackupCodes`, `verifyTempToken` metodlari o'chiriladi
- TotpService import + inject o'chiriladi
- `bcrypt.hash`/`bcrypt.compare` ishlatilgan backup code logikasi o'chiriladi
- `JWT_2FA_SECRET` ishlatuvchi joylar o'chiriladi

- [ ] **Step 4: `auth.module.ts` ni tozalash**

`TotpService` provider va u bilan bog'liq imports o'chiriladi.

- [ ] **Step 5: Frontend 2FA UI o'chirish**

```powershell
Remove-Item "apps/web/app/[locale]/(dashboard)/_components/TwoFactorSection.tsx" -Force
```

`LoginForm.tsx` da 2FA code input form, "2-bosqich tasdiqlash" UI butun bloki o'chiriladi (oddiy username/password formasi qoladi).

Profil sahifa (`apps/web/app/[locale]/(dashboard)/student/profile/page.tsx` yoki shunga o'xshash) — `<TwoFactorSection />` import + chaqiriqi o'chiriladi.

- [ ] **Step 6: Schema va migration**

`prisma/schema.prisma` da `User` modelidan quyidagi 3 maydonni o'chirish:
```prisma
totpSecret       String?
totpEnabled      Boolean    @default(false)
totpBackupCodes  String?
```

Yangi migration yaratish:

```powershell
New-Item -ItemType Directory -Path "prisma/migrations/0049_revert_2fa" -Force
```

`prisma/migrations/0049_revert_2fa/migration.sql`:
```sql
-- Phase 1 Revert — Remove 2FA TOTP columns from users
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "totp_secret",
  DROP COLUMN IF EXISTS "totp_enabled",
  DROP COLUMN IF EXISTS "totp_backup_codes";
```

- [ ] **Step 7: Dependency va env**

`apps/api/package.json` dan `"otplib": "^13.4.0"` o'chiriladi.
`.env.example` va `apps/api/.env.example` dan `TOTP_ENCRYPTION_KEY=...` qatori o'chiriladi.

```powershell
pnpm install
```

- [ ] **Step 8: Quality gates**

```powershell
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api run lint
pnpm --filter web run lint
pnpm --filter api test
pnpm --filter api run build
pnpm --filter web run build
```

Expected: 6 ta gate ham PASS. Husky pre-commit faqat shundan keyin ishlasin.

- [ ] **Step 9: Commit**

```powershell
git add -A
git commit -m "revert(2fa): remove TOTP, backup codes, 2FA endpoints + UI + schema columns"
```

---

## Phase 2: Stripe — To'liq O'chirish

**Files:**
- Delete: `apps/api/src/subscriptions/subscriptions.service.ts` (yoki Stripe qism olib tashlanib, manual logika qoldiriladi)
- Delete: `apps/api/src/subscriptions/subscriptions.controller.ts` (Stripe endpoint'lari)
- Delete: `apps/api/src/subscriptions/webhooks.controller.ts`
- Modify: `apps/api/src/subscriptions/subscriptions.module.ts` — agar butun module faqat Stripe uchun bo'lsa, DELETE; aks holda manual subscription tracking qoldirish uchun trim qilish
- Modify: `apps/api/src/main.ts` — Stripe webhook raw body parser middleware o'chiriladi
- Modify: `apps/api/src/app.module.ts` — `SubscriptionsModule` import (yuqorigi qarorga ko'ra)
- Modify: `apps/api/src/cron/cron.service.ts` — Stripe trial-check / Telegram billing reminder job'i o'chiriladi
- Delete: `apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx`
- Modify: `prisma/schema.prisma` — `TenantSubscription.stripeCustomerId` o'chiriladi
- Modify: `apps/api/package.json` — `stripe` dep o'chiriladi
- Modify: `.env.example`, `apps/api/.env.example` — Stripe env vars o'chiriladi
- Create: `prisma/migrations/0050_revert_stripe/migration.sql`

- [ ] **Step 1: Subscription Service holatini aniqlash**

`apps/api/src/subscriptions/subscriptions.service.ts` ni o'qib, qaror qilish:
- (A) Faqat Stripe — fayl butunlay DELETE
- (B) Stripe + manual subscription mixed — Stripe qismi olib tashlanib, manual logic (markActive/markSuspended) qoldiriladi

Original [Faza 4 spec](../specs/2026-04-30-faza4-tenant-onboarding-design.md) da manual subscription bor: filadmin/superadmin to'lov qabul qildi belgilaydi → status active. Demak, bu funksiya saqlanadi. Stripe qatlam olib tashlanadi.

- [ ] **Step 2: Stripe-specific fayllarni o'chirish**

```powershell
Remove-Item "apps/api/src/subscriptions/webhooks.controller.ts" -Force
```

`subscriptions.controller.ts` da `POST /subscriptions/checkout` va `POST /subscriptions/portal` endpoint'larini olib tashlash. Manual `GET /subscriptions/status`, `POST /subscriptions/manual-mark` (agar bor bo'lsa) qoldiriladi.

`subscriptions.service.ts` da Stripe SDK import (`import Stripe from 'stripe'`), `stripe.checkout.sessions.create`, `stripe.billingPortal.sessions.create`, webhook event handlers — barchasi o'chiriladi. Manual subscription methods qoldiriladi.

- [ ] **Step 3: `main.ts` dan webhook raw body middleware'ni olib tashlash**

`apps/api/src/main.ts` da:
```ts
app.use('/webhooks/stripe', raw({ type: 'application/json' }));
```
qatori (yoki shunga o'xshash) o'chiriladi.

- [ ] **Step 4: `app.module.ts` ni tekshirish**

`SubscriptionsModule` qoladi (manual logic bor), faqat `WebhooksModule` import bo'lsa o'chiriladi.

- [ ] **Step 5: Cron service tozalash**

`apps/api/src/cron/cron.service.ts` da Stripe `trialEndsAt < now + 3 days` Telegram reminder, trial expiry → grace period logikasi o'chiriladi. Faqat manual subscription expiry tracking qoladi (agar bor bo'lsa).

- [ ] **Step 6: Frontend billing UI o'chirish**

```powershell
Remove-Item "apps/web/app/[locale]/(dashboard)/filadmin/billing/page.tsx" -Force
```

Filadmin navigatsiyasida (sidebar, dashboard) `billing` ga link bor bo'lsa, o'chirish.

- [ ] **Step 7: Schema va migration**

`prisma/schema.prisma` da `TenantSubscription` modelidan:
```prisma
stripeCustomerId String? @unique @map("stripe_customer_id")
```
o'chiriladi.

`prisma/migrations/0050_revert_stripe/migration.sql`:
```sql
-- Phase 2 Revert — Remove Stripe customer ID from tenant_subscriptions
ALTER TABLE "tenant_subscriptions"
  DROP COLUMN IF EXISTS "stripe_customer_id";
```

- [ ] **Step 8: Dependency va env**

`apps/api/package.json` dan `"stripe": "^22.1.0"` o'chiriladi.
`.env.example` va `apps/api/.env.example` dan quyidagi vars o'chiriladi:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_ENTERPRISE`
- `NEXT_PUBLIC_FRONTEND_URL` (faqat Stripe uchun bo'lsa)

```powershell
pnpm install
```

- [ ] **Step 9: Quality gates + commit**

```powershell
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api run lint
pnpm --filter web run lint
pnpm --filter api test
pnpm --filter api run build
pnpm --filter web run build
git add -A
git commit -m "revert(stripe): remove Stripe checkout, portal, webhooks; keep manual subscription tracking"
```

---

## Phase 3: i18n — To'liq O'chirish (uz/en/ru → faqat uz)

**Files:**
- Delete: `apps/web/i18n/` (3 fayl)
- Delete: `apps/web/messages/` (uz.json, en.json, ru.json)
- Delete: `apps/web/components/LanguageSwitcher.tsx` (agar mavjud bo'lsa)
- Modify: `apps/web/next.config.ts` — `withNextIntl` plugin o'chiriladi
- Modify: `apps/web/middleware.ts` — i18n routing logic o'chiriladi (faqat tenant subdomain qoladi)
- Modify: `apps/web/app/layout.tsx` — i18n integratsiyasi o'chiriladi
- Move: `apps/web/app/[locale]/*` → `apps/web/app/*` (200+ fayl)
- Delete: `apps/web/app/[locale]/layout.tsx` (NextIntlClientProvider wrapper)
- Modify: 200+ TSX fayl ichidagi `useTranslations()`, `@/i18n/navigation` import'lari
- Modify: `apps/api/src/i18n/errors.ts` — multilang error matnlari faqat uz qoldiriladi (yoki fayl o'chirilib, hardcoded string'larga aylantiriladi)
- Modify: `prisma/schema.prisma` — `Tenant.defaultLocale` o'chiriladi
- Modify: `apps/web/package.json` — `next-intl` dep o'chiriladi
- Create: `prisma/migrations/0051_revert_locale/migration.sql`

- [ ] **Step 1: Folder strukturani qayta o'rnatish (eng katta operatsiya)**

```powershell
cd d:\projects\alochi\apps\web\app
git mv "[locale]/(auth)" "(auth)"
git mv "[locale]/(dashboard)" "(dashboard)"
git mv "[locale]/(marketing)" "(marketing)"
git mv "[locale]/kiosk" "kiosk"
git mv "[locale]/offline" "offline"
Remove-Item "[locale]/layout.tsx" -Force
Remove-Item "[locale]" -Force -Recurse
```

Expected: `[locale]` folder yo'q, ichidagi 200+ fayl bir pog'ona yuqorida.

- [ ] **Step 2: i18n config va messages folderlarni o'chirish**

```powershell
cd d:\projects\alochi
Remove-Item "apps/web/i18n" -Force -Recurse
Remove-Item "apps/web/messages" -Force -Recurse
if (Test-Path "apps/web/components/LanguageSwitcher.tsx") {
  Remove-Item "apps/web/components/LanguageSwitcher.tsx" -Force
}
```

- [ ] **Step 3: `next.config.ts` ni tozalash**

`apps/web/next.config.ts` ni o'qib:
- `import createNextIntlPlugin from 'next-intl/plugin'` qatori o'chiriladi
- `const withNextIntl = createNextIntlPlugin('./i18n/request.ts')` qatori o'chiriladi
- `export default withPWA(withNextIntl(nextConfig))` → `export default withPWA(nextConfig)` ga aylantiriladi

- [ ] **Step 4: `middleware.ts` ni soddalashtirish**

`apps/web/middleware.ts` ni qayta yozish — faqat tenant subdomain extraction + `x-tenant-slug` header injection qoldiriladi:

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const subdomain = extractTenantSubdomain(host);

  const res = NextResponse.next();
  if (subdomain) {
    res.headers.set('x-tenant-slug', subdomain);
  }
  return res;
}

function extractTenantSubdomain(host: string): string | null {
  // Existing logic, just pass-through
  const parts = host.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (['www', 'api', 'admin', 'localhost'].includes(sub)) return null;
  return sub;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

(Real middleware logikasi mavjud kod bilan moslashtiriladi.)

- [ ] **Step 5: `app/layout.tsx` ni original holatiga qaytarish**

`NextIntlClientProvider`, `getMessages`, `getLocale` import'lari va wrapper'lari olib tashlanadi. Oddiy root layout qoladi:

```tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
```

(Mavjud metadata, font, providers integratsiyasi bilan moslashtiriladi.)

- [ ] **Step 6: Bulk find/replace — 200 TSX faylda i18n ishlatilishlarini o'chirish**

`useTranslations` ishlatilgan fayllarni topish:

```powershell
cd d:\projects\alochi\apps\web
Get-ChildItem -Recurse -Include *.tsx,*.ts | Select-String "useTranslations|next-intl|@/i18n/navigation" | Select-Object Path -Unique
```

Har bir fayl uchun:
1. `import { useTranslations } from 'next-intl'` → o'chirish
2. `import { Link } from '@/i18n/navigation'` → `import Link from 'next/link'`
3. `import { useRouter } from '@/i18n/navigation'` → `import { useRouter } from 'next/navigation'`
4. `const t = useTranslations('common')` → o'chirish
5. `{t('save')}` → `Saqlash` (qiymat `messages/uz.json` dan olinib qo'yiladi — Step 6.5 da yagona JSON snapshot olib qo'yiladi)

- [ ] **Step 6.5: Reference uchun uz.json snapshot saqlash**

Fayl o'chirilishidan oldin nusxa olish (replacement uchun):

```powershell
Copy-Item "apps/web/messages/uz.json" "$env:TEMP/uz-snapshot-2026-05-06.json"
```

Bu fayldan `t('key')` chaqiriqlarining qiymatlarini hardcode qilish uchun foydalanamiz. Step 6 tugagach o'chiriladi.

- [ ] **Step 7: Backend i18n errors faylini soddalashtirish**

`apps/api/src/i18n/errors.ts` ni o'qib:
- Agar locale-aware mapping (`{ uz: '...', en: '...', ru: '...' }`) bor bo'lsa — faqat `uz` qoldiriladi va `string` ga aylantiriladi
- Yoki butun fayl o'chirilib, har bir endpoint o'z hardcoded uz xato xabarini ishlatadi

Foydalanuvchi joylar topib, uz string'lariga inline qilinadi.

- [ ] **Step 8: Schema va migration**

`prisma/schema.prisma` da `Tenant` modelidan:
```prisma
defaultLocale String? @default("uz") @map("default_locale")
```
o'chiriladi.

`prisma/migrations/0051_revert_locale/migration.sql`:
```sql
-- Phase 3 Revert — Remove default_locale from tenants
ALTER TABLE "tenants"
  DROP COLUMN IF EXISTS "default_locale";
```

- [ ] **Step 9: Dependency**

`apps/web/package.json` dan `"next-intl": "^4.11.0"` o'chiriladi.

```powershell
pnpm install
```

- [ ] **Step 10: Quality gates + commit**

```powershell
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec tsc --noEmit
pnpm --filter web run lint
pnpm --filter api run lint
pnpm --filter api test
pnpm --filter web run build
pnpm --filter api run build
git add -A
git commit -m "revert(i18n): remove en/ru locales, [locale] routing, next-intl; keep uz only"
```

---

## Phase 4: Brand Rename (Adouptivo → A'lochi)

**Files:**
- 51 fayl, `Adouptivo`/`adouptivo` so'zi bilan (Phase 3 dan keyin ba'zilari yo'qolgan bo'ladi — qaytadan grep qilamiz)

- [ ] **Step 1: Joriy holatni tekshirish**

```powershell
cd d:\projects\alochi
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.md,*.json,*.py | `
  Select-String -Pattern "Adouptivo|adouptivo" -List | `
  Select-Object Path
```

Expected: ~30-40 fayl qoladi (Phase 3 da [locale] fayllar yo'qolgan, lekin nusxalari qoldi).

- [ ] **Step 2: Avtomatik global almashtirish**

Quyidagi PowerShell skripti har bir matched faylda `Adouptivo` → `A'lochi` va `adouptivo` → `a'lochi` qiladi. **DIQQAT:** binary fayllar (logo.png, favicon.ico, manifest.json icon URL'lari) — qo'lda alohida ko'riladi.

```powershell
cd d:\projects\alochi
$exclude = @('node_modules', '.next', '.git', 'dist', 'build')
Get-ChildItem -Recurse -Include *.ts,*.tsx,*.md,*.json,*.py,*.css,*.html | `
  Where-Object {
    $path = $_.FullName
    -not ($exclude | Where-Object { $path -like "*\$_\*" })
  } | `
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    if ($content -match 'Adouptivo|adouptivo') {
      $new = $content -replace 'Adouptivo', "A'lochi" -replace 'adouptivo', "a'lochi"
      Set-Content $_.FullName $new -Encoding UTF8 -NoNewline
      Write-Output "Updated: $($_.FullName)"
    }
  }
```

- [ ] **Step 3: Kontekstga qarab maxsus tuzatishlar**

Ba'zi joylarda `A'lochi` to'g'ri kelmasligi mumkin (masalan, certificate badge'lari `Olmos Adouptivo` → `Olmos A'lochi` to'g'ri). Lekin tekshirish kerak:

- [apps/api/src/gamification/certificates.service.ts](../../../apps/api/src/gamification/certificates.service.ts) — sertifikat label'lari (`Olmos`, `Oltin`, `Kumush`, `Bronza` + brand)
- [apps/web/public/manifest.json](../../../apps/web/public/manifest.json) — PWA `name`, `short_name`
- [README.md](../../../README.md) — title
- Marketing landing kontent (Phase 3 dan keyin yangi yo'lda)

Har bir muhim fayl ko'rib chiqilib, brand to'g'ri matn kontekstida ishlashi tasdiqlanadi.

- [ ] **Step 4: TOTP issuer qatori tekshirish**

`apps/api/src/auth/totp.service.ts` allaqachon Phase 1 da o'chirilgan, demak `issuer: 'Adouptivo'` muammo emas.

- [ ] **Step 5: Quality gates + commit**

```powershell
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api run lint
pnpm --filter web run lint
pnpm --filter api test
pnpm --filter api run build
pnpm --filter web run build
git add -A
git commit -m "revert(brand): rename Adouptivo back to A'lochi across docs, code, manifest"
```

---

## Phase 5: Spec/Plan Archive

**Files:**
- Delete (yoki `.archive/` ga ko'chirish): 6 ta spec/plan fayl

- [ ] **Step 1: Archive papka yaratish**

```powershell
cd d:\projects\alochi
New-Item -ItemType Directory -Path "docs/superpowers/.archive/global-push" -Force
```

- [ ] **Step 2: Spec/plan fayllarni archive ga ko'chirish**

```powershell
$files = @(
  'docs/superpowers/specs/2026-05-05-i18n-full-migration-design.md',
  'docs/superpowers/plans/2026-05-05-i18n-full-migration.md',
  'docs/superpowers/specs/2026-05-05-stripe-payment-design.md',
  'docs/superpowers/plans/2026-05-05-stripe-payment.md',
  'docs/superpowers/specs/2026-05-05-2fa-totp-design.md',
  'docs/superpowers/plans/2026-05-05-2fa-totp.md'
)
foreach ($f in $files) {
  if (Test-Path $f) {
    git mv $f "docs/superpowers/.archive/global-push/"
  }
}
```

- [ ] **Step 3: Commit**

```powershell
git add -A
git commit -m "chore(docs): archive global-push specs/plans (i18n, Stripe, 2FA)"
```

---

## Phase 6: Pitch Deck + Marketing Documentation Rewrite

**Files:**
- Rewrite: `PITCH_DECK.md`
- Rewrite: `PITCH_DECK_INVESTOR.md`
- Rewrite: `ROADMAP.md`
- Modify: `USER_GUIDE.md` (agar multi-country mention bo'lsa)
- Modify: marketing landing TSX fayllar (multi-country positioning)

- [ ] **Step 1: Brainstorming session**

`superpowers:brainstorming` skill ishga tushiriladi. User bilan birga A'lochi MVP positioning aniqlanadi:
- Target audience: 3-7 sinf O'zbek o'quvchilar
- Bozor: faqat O'zbekiston, ingliz tili o'quv markazlari
- Narxlash: manual (filadmin to'lov qabul qiladi), Stripe yo'q
- Brending: "A'lochi" = top student
- Differensiasiya: AI Tutor + Face ID + ota-ona Telegram + status (Yashil/Sariq/Qizil)

Brainstorming natijasi — qisqa positioning hujjat.

- [ ] **Step 2: PITCH_DECK.md qayta yozish**

Original deck: VC pitch, multi-country, Adouptivo brand. Yangi deck: A'lochi, faqat O'zbekiston, internal/customer-focused. ~10-15 slayd:
1. Cover (A'lochi)
2. Problem (O'quv markaz mentor 30+ talaba kuzata olmaydi)
3. Solution (AI Tutor + status + ota-ona Telegram)
4. Product features (Faza 1-4 spec'dan)
5. User journey (o'quvchi/mentor/filadmin)
6. Differentiation
7. Roadmap (Faza 1-4)
8. Team
9. Contact

- [ ] **Step 3: PITCH_DECK_INVESTOR.md qayta yozish**

Original 394 qator (5 davlat, $300K seed, CIS TAM). Yangi: A'lochi MVP investor pitch — agar VC searching qilinsa keyinroq yoziladi. **Sodda variant:** faylni butunlay o'chirish, faqat `PITCH_DECK.md` qoladi.

User bilan tasdiqlash: yangi `PITCH_DECK_INVESTOR.md` kerakmi?

- [ ] **Step 4: ROADMAP.md qayta yozish**

13 ta phase (rename, i18n, Stripe, custom domains, GDPR, 2FA, ...) o'chiriladi. Qayta yoziladi: faqat 4 ta Faza ([2026-04-23-alochi-platform-design.md](../specs/2026-04-23-alochi-platform-design.md) Section 22 dan):
- Faza 1: MVP (Auth, RBAC, lessons, status, attendance, KPI)
- Faza 2: AI va Muloqot (AI Tutor, Azure, MediaPipe, Telegram, gamification, Face ID)
- Faza 3: Intellektual Tizim (adaptive, churn, content quality, social)
- Faza 4: Scale va SaaS (multi-tenant onboarding, ClickHouse, PWA, AI Lesson Generator)

- [ ] **Step 5: Marketing landing inventory**

`apps/web/app/(marketing)/` (Phase 3 dan keyin yangi yo'l) ichidagi sahifalar tekshiriladi:
- `page.tsx`
- `_components/Header.tsx`, `Footer.tsx`, `FAQ.tsx`, `WhyAlochi.tsx`, `CertificateSection.tsx`
- `register/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`

Multi-country / "5 davlat" / Tojikiston, Qozog'iston referenslari topilsa — olib tashlanadi.

- [ ] **Step 6: Quality gates + commit**

```powershell
pnpm --filter web exec tsc --noEmit
pnpm --filter web run lint
pnpm --filter web run build
git add -A
git commit -m "revert(pitch): rewrite pitch decks and roadmap for A'lochi MVP (Uzbekistan-only)"
```

---

## Phase 7: Final Verification (Sonnet)

> Bu phase Sonnet bilan bajariladi (foydalanuvchi requirement). Opus session tugaydi, yangi Sonnet session ochilib, branch'da quyidagi tekshiruvlar o'tkaziladi.

- [ ] **Step 1: Full quality gates qayta ishga tushirish**

```powershell
cd d:\projects\alochi
pnpm install
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api run lint
pnpm --filter web run lint
pnpm --filter api test
pnpm --filter api run build
pnpm --filter web run build
```

Expected: 8 ta gate ham PASS.

- [ ] **Step 2: Reversion to'liqligini tekshirish**

```powershell
# Adouptivo qoldiqlari yo'qmi
$leaks = Get-ChildItem -Recurse -Include *.ts,*.tsx,*.md,*.json | `
  Where-Object { $_.FullName -notlike '*\node_modules\*' -and $_.FullName -notlike '*\.next\*' } | `
  Select-String -Pattern "Adouptivo" -List
$leaks.Count  # Expected: 0

# next-intl qolmadimi
Select-String -Path "apps/web/**/*.ts*" -Pattern "next-intl|useTranslations" -List

# Stripe qolmadimi
Select-String -Path "apps/api/src/**/*.ts" -Pattern "import Stripe|stripe\." -List

# TOTP qolmadimi
Select-String -Path "apps/**/*.ts*" -Pattern "totpSecret|otplib|backup_codes" -List

# [locale] folder yo'qmi
Test-Path "apps/web/app/[locale]"  # Expected: False

# Schema toza
Select-String -Path "prisma/schema.prisma" -Pattern "totp|stripe_customer_id|default_locale"
```

- [ ] **Step 3: Migration ketma-ketligini tekshirish**

```powershell
pnpm --filter api exec prisma validate
pnpm --filter api exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

Expected: schema.prisma va migration history rozi.

- [ ] **Step 4: Dev server smoke test**

```powershell
pnpm dev:api
# alohida terminal:
pnpm dev:web
```

Browser'da `localhost:3000` ochiladi:
- Landing sahifa A'lochi brending bilan ko'rinishi
- `/login` ishlashi (2FA bosqichi yo'q)
- Superadmin login → dashboard ochilishi
- Filadmin sahifada billing yo'q (Stripe olib tashlangan)
- Til o'tkazgich yo'q (i18n olib tashlangan)

- [ ] **Step 5: PR yaratish**

```powershell
gh pr create --title "Revert to A'lochi MVP" --body @"
## Summary
- Removed 2FA TOTP (auth flow simplified to username + password + JWT)
- Removed Stripe payment integration (manual subscription tracking only)
- Removed i18n (uz/en/ru) — Uzbek-only UI
- Renamed brand: Adouptivo → A'lochi (51 files)
- Archived global-push specs/plans
- Rewrote PITCH_DECK.md, ROADMAP.md for Uzbekistan-only A'lochi MVP
- 3 schema rollback migrations: 0049 (2fa), 0050 (stripe), 0051 (locale)

## Test plan
- [ ] Quality gates pass (tsc, lint, test, build)
- [ ] Login works without 2FA step
- [ ] No Stripe pages accessible
- [ ] No language switcher
- [ ] All schema migrations apply cleanly on fresh DB
- [ ] Dev server boots and landing page shows A'lochi branding
"@
```

---

## Self-Review

**Spec coverage:**
- Adouptivo → A'lochi rename: Phase 4 ✓
- i18n removal: Phase 3 ✓
- Stripe removal: Phase 2 ✓
- 2FA removal: Phase 1 ✓
- Pitch deck rewrite: Phase 6 ✓
- Spec/plan archive: Phase 5 ✓
- Migration rollbacks: Phase 1 (0049), Phase 2 (0050), Phase 3 (0051) ✓
- Dependency cleanup (`otplib`, `stripe`, `next-intl`): Phase 1, 2, 3 ✓
- Env var cleanup: Phase 1, 2 ✓
- Final verification: Phase 7 ✓

**Placeholder scan:** "TBD" yoki "later" yo'q. PowerShell skript va exact qatorlar berilgan.

**Type consistency:** Schema o'zgarishlari aniq nomlandi (totpSecret, stripeCustomerId, defaultLocale). Migration filename'lar ketma-ket (0049, 0050, 0051).

**Riskni tekshirish:**
- Phase 3 (i18n) eng katta operatsiya — 200+ fayl ko'chirish + ichidagi import o'zgarishi. Step 6 da har bir faylga grep + edit qilamiz, sabr-toqat bilan.
- Quality gate'lar har phase oxirida — agar sinsa, oldingi phase'ga qaytmasdan, current phase ichida tuzatib commit qilamiz.
- Husky pre-commit yoqilgan — `--no-verify` ishlatilmaydi (CLAUDE.md sacred bar).
