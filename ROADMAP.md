# A'lochi — World-Class SaaS Roadmap

> Har bir phase quality gates (typecheck + lint + build + tests) dan o'tgandan
> keyin commit qilinadi. Hech bir phase yarim holda qoldirilmaydi.

---

## Bajarilgan phasalar (2026-05)

| Phase | Commit | Holat |
|---|---|---|
| Phase 1 — Brand rename (A'lochi → A'lochi) | d0d0c71 | ✅ |
| Phase 2 — Filadmin tenant content (lessons CRUD + UI) | c28bc36 | ✅ |
| Phase 3 — Tenant branding (logo, color, brandName) | d8da090 | ✅ |
| Phase 4 — Template lesson library | d8da090 | ✅ |
| Phase 5 — Self-service onboarding (/register + trial) | eb950bb | ✅ |
| Phase 6 — i18n infrastructure (uz/en/ru) | 43ed337 | ✅ (infra ready, pages deferred) |
| Phase 7 — Payment integration (Stripe/Payme/Click scaffold) | 4347fb7 | ✅ |
| Phase 8 — Subdomain/custom domain middleware | 43ed337 | ✅ |
| Phase 9 — GDPR (/privacy + /terms pages) | eb950bb | ✅ |
| Phase 10 — Mobile PWA manifest | 4347fb7 | ✅ |
| Phase 11 — Rate limiting (@nestjs/throttler) | 43ed337 | ✅ |
| Phase 12 — Sentry monitoring | 43ed337 | ✅ |
| Phase 13 — Security audit log (schema + UI + migration) | 4347fb7 | ✅ |

**411/411 tests pass. Build clean.**

---

## Keyingi sprint uchun qolganlar (Phase 6b, 7b, 13b...)

- **Phase 6b** — `[locale]` folder migration: landing + dashboard pages `withNextIntl` plugin bilan
- **Phase 7b** — Real gateway integration: Stripe HMAC verify, Payme test key, Click production
- **Phase 13b** — 2FA (TOTP authenticator), IP allowlist superadmin uchun, SystemAuditLog yozish (login/logout/user.create)
- **Phase 11b** — Redis caching, DB indexes `EXPLAIN ANALYZE` bilan
- **Phase 14** — AI content generation (filadmin uchun dars yaratish assistenti)
- **Phase 15** — Lesson marketplace (markazlar darslarni sotsin/sotib olsin)

---

---

## PHASE 1 — Brand Rename: A'lochi → A'lochi
**Maqsad:** Har bir kod qatoridagi "A'lochi" ni olib tashlab "A'lochi" qo'yish.

- [ ] `apps/api/src/main.ts` — Swagger title, logger nomi
- [ ] `apps/web/next.config.ts` — siteName, metadata
- [ ] `apps/web/app/(marketing)/page.tsx` — SEO metadata, OG
- [ ] `apps/web/app/(marketing)/_components/Header.tsx` — logo matni
- [ ] `apps/web/app/(marketing)/_components/Footer.tsx` — brend nomi
- [ ] `apps/web/app/(marketing)/_components/Hero.tsx` — hardcoded nom
- [ ] `apps/web/app/(marketing)/_components/CertificateSection.tsx`
- [ ] `apps/api/src/gamification/certificates.service.ts` — sertifikat PDF matni
- [ ] `apps/api/src/cron/cron.service.ts` — Telegram xabarnomalari
- [ ] `prisma/seed-demo.ts` — demo tenant nomi
- [ ] `README.md`, `DEPLOYMENT.md`, `PITCH_DECK.md`, `USER_GUIDE.md`
- [ ] `docs/` — barcha qo'llanmalar
- [ ] `.env.example` — izohlar

---

## PHASE 2 — Tenant Content: Filadmin darslarni boshqarsin
**Maqsad:** Har bir markaz o'z darslarini mustaqil yaratsin. Superadmin boshqa markazning darsini ko'rmasin.

- [ ] `LessonsController` — `filadmin` rolga `GET/POST/PATCH/DELETE` ruxsat
- [ ] `LessonsService` — yaratishda `tenantId = req.user.tenantId` majburiy
- [ ] `LessonsService` — `findAll` faqat `req.user.tenantId` bo'yicha filter
- [ ] `LessonComponentsController` — filadmin ruxsat
- [ ] `/superadmin/lessons` — faqat superadmin o'z darslarini ko'rsin
- [ ] `/filadmin/lessons` — yangi sahifa (list + create + edit + publish)
- [ ] `/filadmin/lessons/new` — dars yaratish formasi
- [ ] `/filadmin/lessons/[id]` — dars tahrirlash (komponentlar bilan)
- [ ] TopNav — filadmin uchun "Darslar" menyu bandi
- [ ] Testlar yangilanishi

---

## PHASE 3 — Tenant Branding
**Maqsad:** Har markaz o'z nomi, logotipi va rangida ishlaydi.

- [ ] `Tenant` modeli — `logoUrl`, `primaryColor`, `brandName`, `faviconUrl` maydonlari
- [ ] DB migration `0040_tenant_branding`
- [ ] `TenantsService` + `TenantsController` — yangi maydonlar
- [ ] `/superadmin/tenants/new` va `/edit` — branding formasi
- [ ] Login sahifasi — `?tenant=slug` orqali tenant logotipi ko'rsatish
- [ ] Dashboard layout header — `"A'lochi"` o'rniga `tenant.brandName`
- [ ] Student dashboard — tenant nomi
- [ ] Sertifikat PDF — tenant logoUrlini embed qilish
- [ ] Telegram bot xabarlari — `tenant.brandName` ishlatish

---

## PHASE 4 — Template Lesson Library
**Maqsad:** Superadmin "global shablon" darslar yaratadi. Filadmin ulardan nusxa oladi.

- [ ] `Lesson` modeli — `isTemplate Boolean` maydoni
- [ ] DB migration `0041_lesson_templates`
- [ ] `LessonsService.findTemplates()` — barcha template darslar
- [ ] `LessonsService.importFromTemplate(lessonId, tenantId)` — nusxa olish
- [ ] `GET /lessons/templates` — public+auth endpoint
- [ ] `POST /lessons/import/:templateId` — filadmin nusxa oladi
- [ ] `/superadmin/lessons` — template belgisi (star icon)
- [ ] `/filadmin/lessons` — "Shablon kutubxonasidan import" tugmasi
- [ ] Import modal — template list + tanlash + bulk import

---

## PHASE 5 — Self-Service Onboarding
**Maqsad:** Yangi markaz egasi o'zi ro'yxatdan o'tib, 5 daqiqada ishga tushsin.

- [ ] Public `/register` sahifasi — markaz nomi, slug, admin ism/login/parol
- [ ] `POST /auth/register-tenant` — yangi tenant + filadmin yaratish
- [ ] Email yoki Telegram orqali tasdiqlash (OTP)
- [ ] Trial period logic — 14 kun bepul, keyin to'lov
- [ ] Onboarding wizard (3 qadam): 1) Branding 2) Birinchi dars 3) Birinchi o'quvchi
- [ ] Welcome email/Telegram xabar
- [ ] Landing page "Bepul boshlash" tugmasi → `/register`

---

## PHASE 6 — Internationalization (i18n)
**Maqsad:** O'zbek, Rus, Ingliz tillari — global bozor.

- [ ] `next-intl` kutubxona o'rnatish
- [ ] `apps/web/messages/uz.json` — barcha string'lar
- [ ] `apps/web/messages/en.json` — ingliz tarjimasi
- [ ] `apps/web/messages/ru.json` — rus tarjimasi
- [ ] Middleware: `Accept-Language` header yoki `?lang=en`
- [ ] UI: Til tanlash komponenti (TopNav yoki Login)
- [ ] API error messages — `lang` parametri bo'yicha
- [ ] Tenant sozlamasida default til

---

## PHASE 7 — Payment Integration
**Maqsad:** Avtomatik obuna tizimi — to'lov kelsa aktiv, kelmasa blok.

- [ ] Stripe global integratsiya (`@stripe/stripe-js`)
- [ ] Payme webhook handler (O'zbekiston)
- [ ] Click webhook handler (O'zbekiston)
- [ ] `Subscription` Prisma modeli — plan, status, nextPaymentDate, gateway
- [ ] DB migration `0042_subscriptions`
- [ ] `SubscriptionsService` — to'lov holati boshqaruvi
- [ ] `SubscriptionsController` — webhook qabul qilish
- [ ] Auto-block: to'lov muddati o'tsa tenant `isActive=false`
- [ ] Auto-unblock: to'lov kelsa `isActive=true`
- [ ] `/superadmin/subscriptions` — barcha obunalar paneli
- [ ] `/filadmin/billing` — joriy obuna holati va to'lov tarixi
- [ ] Stripe Customer Portal redirect

---

## PHASE 8 — Custom Domain / Subdomain
**Maqsad:** `abc-english.alochi.com` yoki `abc.uz` — har markaz o'z URL'i.

- [ ] `Tenant` modeli — `subdomain`, `customDomain` maydonlari
- [ ] DB migration `0043_tenant_domains`
- [ ] Next.js middleware — `Host` header bo'yicha tenant aniqlash
- [ ] `tenantContext` server-side props injection
- [ ] Login sahifasi — subdomainsiz `login.alochi.com` universal
- [ ] `/superadmin/tenants/[id]/edit` — subdomain va custom domain sozlash
- [ ] DNS yo'riqnomasi hujjati
- [ ] SSL wildcard sertifikat ko'rsatma (Caddy/nginx)

---

## PHASE 9 — GDPR + Legal Compliance
**Maqsad:** Yevropa va global bozor uchun huquqiy talablar.

- [ ] `/privacy` — Maxfiylik siyosati sahifasi
- [ ] `/terms` — Foydalanish shartlari sahifasi
- [ ] Cookie consent banner komponenti
- [ ] `DELETE /users/me` — GDPR right to erasure (o'z ma'lumotlarini o'chirish)
- [ ] `GET /users/me/export` — ma'lumotlarni JSON/CSV eksport
- [ ] `Tenant` modeli — `gdprRegion`, `dataResidency` maydonlari
- [ ] DB migration `0044_gdpr_fields`
- [ ] DemoForm'dagi privacy link to'ldirish (`/privacy` havolasi)
- [ ] Cookie-free analytics mode (GDPR tenantlar uchun)

---

## PHASE 10 — Mobile PWA Polish
**Maqsad:** iOS va Android'da native-ga yaqin tajriba.

- [ ] Offline dars o'qish — Service Worker cache strategy
- [ ] Push notifications — Web Push API
- [ ] Install prompt komponenti (PWA add-to-homescreen)
- [ ] Mobile-specific touch gestures (swipe to next component)
- [ ] Kamera full-screen mobile rejimi
- [ ] iOS Safari audio unlock (talaffuz komponentlari uchun)
- [ ] `manifest.json` — A'lochi nomi, ikonlar, rang
- [ ] Lighthouse score ≥ 90 barcha kategoriyada

---

## PHASE 11 — Performance & Scale
**Maqsad:** 100,000+ o'quvchi bo'lganda ham tezkor ishlash.

- [ ] `@nestjs/throttler` rate limiting — barcha public endpoint'lar
- [ ] Redis caching — `hot` endpoint'lar (/lessons, /marketing/landing)
- [ ] `REDIS_URL` `.env.example` ga qo'shish
- [ ] Prisma query optimization — N+1 muammolarini hal qilish
- [ ] DB indexes audit — `EXPLAIN ANALYZE` bilan sekin so'rovlar
- [ ] Image optimization — `next/image` barcha joylarda
- [ ] Bundle analyzer — keraksiz paketlarni aniqlash
- [ ] CDN yo'riqnomasi (Cloudflare/BunnyCDN media assets uchun)
- [ ] PgBouncer connection pooling hujjati

---

## PHASE 12 — Monitoring & Observability
**Maqsad:** Production xatolar real-vaqtda aniqlansin va xabar berilsin.

- [ ] Sentry integratsiya (API + Web)
- [ ] `SENTRY_DSN` `.env.example` ga qo'shish
- [ ] Custom error boundary — Sentry bilan
- [ ] Uptime monitoring (Better Uptime yoki UptimeRobot) yo'riqnomasi
- [ ] Telegram alert channel — critical xatolar uchun
- [ ] `/health` endpoint kengaytirish — DB + Redis + ClickHouse status
- [ ] Grafana dashboard yo'riqnomasi (Prometheus metrics)
- [ ] Log aggregation — Loki/ELK yo'riqnomasi

---

## PHASE 13 — Security Hardening
**Maqsad:** Enterprise-grade xavfsizlik.

- [ ] 2FA (TOTP) — superadmin va filadmin uchun
- [ ] IP allowlisting — superadmin login uchun
- [ ] API key tizimi — tenant'lar tashqi integratsiya qilsin
- [ ] Audit log UI — `/superadmin/audit-log` sahifasi
- [ ] Session revocation — barcha tokenlarni bir vaqtda bekor qilish
- [ ] Suspicious login detection — boshqa geo/IP dan kirish
- [ ] Content Security Policy nonce-based scripts
- [ ] Dependency vulnerability scan (npm audit) CI'ga qo'shish
- [ ] Penetration test checklist hujjati

---

## Jami: 13 Phase, ~150 task
## Taxminiy vaqt: 40-50 ish kuni (to'liq jamoa bilan 3-4 hafta)
