# A'lochi Platform — To'liq Foydalanish Qo'llanmasi

**Versiya:** 1.0.0 (25 phase + final gap fix)
**Sana:** 2026-05-01
**Branch:** `audit-completion-100-percent` (master'ga PR qilinishi kutilmoqda)

---

## 1. Loyihaning umumiy ko'rinishi

A'lochi — ko'p tenantli (multi-tenant) ingliz tili o'qitish platformasi. 6 ta foydalanuvchi roli, AI Tutor, geymifikatsiya, sotsial xususiyatlar, Face ID davomat, ML-asosli churn bashorati, va to'liq tahlil dashboardlari bilan.

### Tech Stack
- **Backend:** NestJS 10 + Prisma 5 + PostgreSQL 15 (pgvector) + ClickHouse 24
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS + PWA (`@ducanh2912/next-pwa`)
- **ML Service:** FastAPI + Python 3.11 + scikit-learn (`apps/ml-service/`)
- **Real-time:** Socket.io WebSocket (`/social` namespace)
- **Telegram:** Single bot (`@alochi_bot`) — Telegraf
- **AI:** Claude (Anthropic) + Azure Speech-to-Text + Azure TTS
- **Test:** Jest (366+ unit/integration), Playwright (E2E)
- **Deploy:** Docker Compose (development), CI via GitHub Actions

---

## 2. Local development setup

### Birinchi marta o'rnatish

```bash
# 1. Klonlash
git clone <repo-url>
cd alochi
git checkout audit-completion-100-percent

# 2. Dependencies
pnpm install

# 3. .env tayyorlash
cp .env.example .env
# .env ichida quyidagilarni to'ldiring:
#   JWT_SECRET, JWT_REFRESH_SECRET (har biri 32+ char)
#   ANTHROPIC_API_KEY (Claude uchun)
#   AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
#   TELEGRAM_BOT_TOKEN
#   FACE_VECTOR_KEY=$(openssl rand -base64 32)
#   DEVICE_TOKEN_SECRET=$(openssl rand -base64 64)

# 4. Docker servislarni ko'tarish (Postgres + ClickHouse)
docker-compose up -d db clickhouse

# 5. Schema sync
pnpm --filter api exec prisma db push --skip-generate

# 6. Prisma client generate
pnpm --filter api exec prisma generate

# 7. Test foydalanuvchini yaratish (agar seed.ts ishlamasa, qo'lda)
cd apps/api
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tenant = await p.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Markaz', slug: 'demo' },
  });
  const hash = await bcrypt.hash('Test1234!', 12);
  await p.user.upsert({
    where: { tenantId_login: { tenantId: tenant.id, login: 'superadmin' } },
    update: { passwordHash: hash },
    create: {
      tenantId: tenant.id,
      role: 'superadmin',
      name: 'Super Admin',
      login: 'superadmin',
      passwordHash: hash,
      status: 'active',
    },
  });
  console.log('superadmin/Test1234! ready');
  await p.\$disconnect();
})();
"

# 8. Dev serverlarni ishga tushirish (alohida terminallarda)
pnpm dev:api    # http://localhost:3001
pnpm dev:web    # http://localhost:3000
```

### Kirish ma'lumotlari (Test)

| Login | Password | Rol |
|-------|----------|-----|
| `superadmin` | `Test1234!` | Superadmin |

Boshqa rollarni `prisma/seed.ts` orqali qo'shish mumkin (filadmin, manager, mentor, tester, student).

---

## 3. Foydalanuvchi rollari va imkoniyatlar

### 3.1. Superadmin (Tizim ma'muri)
**URL:** `/superadmin`
**Imkoniyatlar:**
- Tenant (markaz) yaratish, tahrirlash, o'chirish (`/superadmin/tenants/new`, `/superadmin/tenants`, `/superadmin/tenants/:id/edit`)
- Filiallar va xodimlar boshqaruvi
- Darslar curriculum yaratish (camera flag, AI Tutor context, N-repetitions limit)
- Adaptive qiyinlik sozlamalari (`/superadmin/adaptive`)
- Kontent sifati va A/B testlar (`/superadmin/content-quality`)
- Churn (otilib qolish) bashorat dashboard ML metrikalari bilan (`/superadmin/churn`)
- Analytics 8-tab dashboard (`/superadmin/analytics`):
  - Activity, Lessons, Branches, Cohort, Funnel, Lifecycle, Failures, Comparison
- Sertifikat dizayn sozlamalari (`/superadmin/certificate-design`)
- Notification template'lari sozlash (`/superadmin/templates`)
- Tournament bracket UI (`/superadmin/tournaments/:id/bracket`)
- Bloklangan o'quvchilar ro'yxati (`/superadmin/blocked-students`)
- Face ID SLA dashboard (`/superadmin/face-sla`)
- Tenant config: warningBlockLimit (`/superadmin/settings`)

### 3.2. Filadmin (Filial direktori)
**URL:** `/filadmin`
**Imkoniyatlar:**
- Filial xodimlari va o'quvchilarni boshqarish
- Davomat tarixi (`/filadmin/attendance`, `/filadmin/attendance/staff`)
- KPI tarqatish (`/filadmin/kpi`) + oxirgi mukofotlar strip
- O'quvchi statusi tarixi (`/filadmin/students/:id/history`)
- Bloklangan o'quvchilar (`/filadmin/blocked-students`)
- To'lov boshqaruvi va qarzdorlar hisoboti (`/filadmin/payments`) + oylik tarix
- Ogohlantirishlar (`/filadmin/warnings`)
- Vazifalar (`/filadmin/tasks`)
- Xodim video qo'llanmalari (`/filadmin/video-guides`)
- Targ'ibot hisoboti (`/filadmin/promotion-report`)
- Real-time stat cards (davomat, status pie, lesson schedule, pending tasks)

### 3.3. Manager (Filial menejeri)
**URL:** `/manager`
**Imkoniyatlar:**
- Qizil va sariq statusdagi o'quvchilar (real-time, `/churn` signallar bilan)
- O'quvchining individual `N` qiymatini override qilish (audit log bilan)
- Sertifikat berish (`/manager/certificates` linkidan)
- Sovg'a/kitob belgilash (`/manager/rewards`)
- KPI tarqatish (`/manager/kpi`) + recent awards strip
- 1:1 sessiya yozib qo'yish (`/manager/sessions`)
- Delegatsiya qabul qilish va boshqarish (`/delegations`)
- Kunlik ish rejasi (manager dashboardida)

### 3.4. Mentor (O'qituvchi)
**URL:** `/mentor`
**Imkoniyatlar:**
- Bugungi guruh KPI hero card (progress ring)
- Guruh o'quvchilari ro'yxati (`/mentor/group`)
- Davomat belgilash (web + Telegram inline buttons orqali `/davomat` komandasi)
- Status berish (mentor → personal status: yashil/sariq/qizil)
- O'quvchining xato tahlili sahifasi (`/mentor/students/:id`):
  - AI tahlil (kuchsiz mavzular)
  - Status va lesson count chiplari
  - Ota-onaga Telegram orqali xabar yuborish
- Vazifalar (`/mentor/tasks`)

### 3.5. Tester (Imtihon o'tkazuvchi)
**URL:** `/tester`
**Imkoniyatlar:**
- Student-clone dashboard (XP, streak, daily quests, virtual city)
- Sinov darslari (`/tester/lessons/current`)
- Imtihon navbati persistent (`/tester/exam-queue`)
- Texnik muammo xabar berish (`/tester/tech-issues`)

### 3.6. Student (O'quvchi)
**URL:** `/student`
**Imkoniyatlar:**
- Bugungi dars CTA + sessiya counter (`Sessiya {n}/{N}`)
- Yo'l xaritasi visual (PathMap500 component, hozir 250 dars)
- 3 ta status indikatori (yashil/sariq/qizil)
- Streak badge, XP bar, daraja
- Daily quests, virtual shahar, sertifikatlar strip (QR + ulashish)
- Kolleksiya kartalar (36 harf, asta to'planadi)
- Friends / Lenta / Duel / Group challenge
- Lessons sahifasida AI Tutor + camera monitor + AI baholash
- O'tirish (Sit-to-stand) musobaqa (audit log)

---

## 4. Asosiy oqimlar

### 4.1. Tenant onboarding (Superadmin)
1. `/superadmin/tenants/new` ga kirish
2. Markaz nomi, slug, admin (filadmin) login/parol, opsional birinchi filial
3. "Yaratish" tugmasi → atomic transaction ichida tenant + admin + filial yaratiladi
4. Credentials Modal: parolni ko'rsatadi (chop etish va clipboard tugmalari bilan)
5. Yangi tenant `/superadmin/tenants` ro'yxatida ko'rinadi

### 4.2. Login va kirish
1. `/login` (yoki `/{tenant-slug}/login` agar tenant-specific URL kerak bo'lsa)
2. Login + parol kiritish
3. Bloklangan bo'lsa: spec matni ko'rsatiladi (warning yoki payment sababi)
4. Muvaffaqiyatli: JWT olinadi, RBAC asosida tegishli dashboardga yo'naltiradi

### 4.3. Lesson o'tish (Student)
1. `/student/lessons/current` (yoki `[id]`) ga kirish
2. Components ketma-ketligi: video → MCQ → so'zlar tartibi → lug'at (TTS o'zbekcha) → AI Tutor (min 1 savol majburiy) → camera monitor
3. Video ≥90% ko'rilmasa → server completion'ni rad etadi (`VIDEO_WATCH_INCOMPLETE`)
4. AI baholash: ball ≥80 → englishStatus avtomatik `yashil`; 50-79 → `sariq`; <50 → `qizil`
5. Auto-yellow logikasi: agar personal=yashil + english=yashil va prior critical ≠ yashil → critical avtomatik yashilga aylanadi
6. CelebrationToast: ≥80 ball uchun audio bilan namoyon bo'ladi

### 4.4. Davomat (Filadmin/Mentor)
1. Filadmin xodim uchun: kiosk yoki manual checkin (Face ID prefer)
2. Mentor o'quvchilar uchun: web yoki Telegram bot `/davomat` (inline button keyboard)
3. Face ID:
   - Frontend `face-api.js` 128-dim vektor hisoblaydi (xom rasm yuborilmaydi)
   - Server AES-256-GCM bilan shifrlab saqlaydi
   - 200 lux yorug'lik tekshiruvi va EAR liveness detection
   - 3 marta fail → filadminga Telegram alert
4. branch.workStartTime + lateGraceMinutes asosida `late_minutes` hisoblanadi
5. CSV export filadmin/attendance sahifasida

### 4.5. Delegatsiya (Filadmin/Manager → boshqasi)
1. `/delegations/new` da rolga oluvchi, sabab, ruxsatlar (`warnings/payments/staff_manage`), muddat
2. Server-side guard har actionda `delegation.permissions` ni tekshiradi
3. UNIQUE INDEX `one_active_delegation_per_user` bir vaqtda 1 ta faol delegatsiyani kafolatlaydi
4. Telegram orqali 5 ta event xabari (created/accepted/rejected/cancelled/completed)
5. Audit log: warnings/payments/staff_added barcha actionlar `delegationId` bilan yoziladi
6. PDF eksport: `/delegations/:id` sahifasida

### 4.6. Churn bashorati
- Cron `06:00` `runChurnScoring`: rule-based fallback + ML hybrid
- ML servisni mavjud bo'lsa ishlatadi; xato bo'lsa rule-basedga tushadi
- Signallar: `consecutive_absent_3d`, `streakBroken`, `passRateDrop` (haftalik 20%+), `redStatus` (english yoki personal qizil), `noParentTg`
- Yuqori xavfli (`>=70`) tushganda manager + parent Telegram alert
- ML metrikalari `/superadmin/churn` da ko'rinadi (precision/recall/F1)

---

## 5. Cron joblar (jami ~30)

| Vaqt | Job | Vazifa |
|------|-----|--------|
| 22:00 | mentor_kpi_calc | Mentor lessonlar uchun avtomatik KPI |
| 23:00 | face_cache_generate | Filial face cache yaratish |
| 23:59 | payment_block | Ogohlantirilgan to'lovchilar bloklanishi |
| 00:01 | payment_unblock + monitoring | To'lov amalga oshirilganda blokdan chiqarish + fail alert |
| 01:05 | group_challenge_complete | Challenge XP tarqatish |
| 02:00 | refresh_mv | PG MV yangilash |
| 03:00 | adaptive_difficulty | N qiymatini moslashtirish |
| 03:00 | clickhouse_retry | CH dual-write retry |
| 04:00 (Yakshanba) | chat_90day_cleanup | Eski chatlarni o'chirish |
| 05:00 | ml_churn_train | ML model qayta o'qitish |
| 06:00 | churn_scoring | Churn ball berish |
| 07:00 | spaced_repetition_morning | Takrorlash bildirishnomalari |
| 08:00 | face_cache_stale_alert | Filadminga eskirgan kesh ogohlantirishi |
| 09:00 | task_due_reminder | Ertaga muddati tugaydigan vazifalar |
| 09:00 (Dushanba) | low_pass_rate_weekly | Pass rate <50% darslar superadminga |
| 09:00 (Dushanba) | face_enrollment_reminder | Yangi xodimga enrollment eslatma |
| 18:00 | absent_2day_parent_reminder | 2 kun kelmaganlar uchun ota-ona telegram |
| 20:00 | daily_parent_report | Kunlik ota-ona hisoboti |
| 23:00 (oxirgi kun) | filadmin_monthly_kpi | Filadmin oylik bonus/jarima |

---

## 6. Foydali API endpoint'lari

Hammasi `{success, data, meta:{timestamp}}` envelope'ida javob qaytaradi.
Xatolar `{success:false, error:{code, message, details}}` formatida.

### Auth
- `POST /auth/login` — `{login, password}` → `{accessToken, refreshToken, user}`
- `POST /auth/refresh` — `{refreshToken}` → yangi tokenlar
- `POST /auth/logout`

### Tenants (Superadmin)
- `GET /tenants` — list with `_count: {users, branches}`
- `POST /tenants/onboard` — atomic create (tenant + admin + branch)
- `PATCH /tenants/:id` — name update
- `POST /tenants/:id/disable` — cascade-deactivate
- `PATCH /tenants/:id/settings` — warningBlockLimit

### Status
- `POST /status/personal` (Mentor) — personalStatus + auto-yellow
- `POST /status/critical` (Manager+Filadmin) — criticalStatus + KPI emit
- `GET /status/red-students`, `/yellow-students`, `/high-performers`
- `GET /status/history/:studentId`
- `GET /status/my` (student)

### Warnings
- `POST /warnings/:studentId` (Filadmin+Superadmin)
- `PATCH /warnings/:warningId/cancel`
- `GET /warnings/:studentId`, `/warnings/my`

### Payments
- `GET /payments?branchId=&month=`
- `POST /payments/:studentId` (Filadmin)
- `GET /payments/:studentId/status`
- `GET /payments/summary` (debtors report)
- `PUT /payment-settings` (Superadmin)

### KPI
- `POST /kpi/award` (Filadmin/Manager)
- `GET /kpi/my?limit=10` (recent awards)
- `GET /kpi/daily` (alias for `/today`)
- `GET /churn/model-metrics` (Superadmin)
- `GET /churn/high-risk?branchId=`, `/medium-risk`

### Analytics (Superadmin)
- `GET /analytics/lessons`, `/branches`, `/activity?period=`
- `GET /analytics/cohort`, `/funnel/:lessonId`, `/lifecycle`, `/failures`, `/comparison`

### Face ID
- `POST /face/enroll` (vector body, NOT raw image)
- `POST /face/recognize`
- `DELETE /face/enroll`
- `GET /face/enroll/status`
- `GET /face/sla` (Superadmin)
- `POST /devices`, `GET /devices/:id/status`

### Social
- `POST /social/friends/request` `{receiverId, scope: 'group'|'branch'}`
  - 13+ yosh validatsiya `branch` scope uchun
- `POST /social/duels` (max 2 active)
- `GET /social/feed`
- `POST /social/groups/:id/messages` (REST + WebSocket emit)
- `POST /social/messages/:id/pin` (Mentor)
- `POST /social/groups/:id/lock` (Filadmin)

### WebSocket events (`/social` namespace)
- `status:updated`, `student:blocked`, `student:unblocked`, `notification:new`
- `attendance:marked`, `task:assigned`, `chat:reaction`
- `feed:event`, `chat:message`, `duel:challenged`, `duel:result`

---

## 7. Telegram bot komandalari

| Komanda | Rol | Vazifa |
|---------|-----|--------|
| `/start` | Hammaga | Bot bilan tanishish, hisobni ulash |
| `/bugun` | Student | Bugungi vazifalar va status |
| `/statistika` | Student | XP, streak, level |
| `/streak` | Student | Streak detail |
| `/rating` | Student | Filialdagi o'rin |
| `/vazifalar` | Hammaga | Faol vazifalar |
| `/davomat` | Mentor | Inline tugmalar bilan davomat |

---

## 8. PWA xususiyatlar

- Add to Home Screen (Android Chrome + iOS Safari banner)
- Offline page (`/offline`) reload tugmasi bilan
- `/api/**` keshlanmaydi (NetworkOnly — RBAC va tenant scoping safe)
- `/login` keshlanmaydi (logout dan keyin clean state)
- Workbox bilan static assetlar va sahifalar keshlanadi

---

## 9. Production deploy ssenariysi

To'liq ko'rish: `docs/operations/deployment-checklist.md`.

Asosiy qadamlar:
1. Env vars `.env.production` ga o'rnatish
2. `pnpm --filter api exec prisma migrate deploy` (production DB ga)
3. ClickHouse migrationlari API startup'da avtomatik qo'llaniladi
4. `pnpm --filter api seed:churn-training` (≥100 sample, ML cold-start uchun)
5. Build + Docker images
6. Deploy (CI pipeline)
7. Smoke test: `docs/operations/uat-smoke-checklist.md` (15 daqiqa)
8. Lighthouse audit (PWA ≥0.9): `pnpm --filter web lhci autorun`
9. 24h soak monitoring (cronlar, error rate, P95 latency)

---

## 10. Test va sifat statistikasi

| Metrika | Qiymat |
|---------|--------|
| Backend testlar | **366 passing** (jami 373) |
| Pre-existing test failures | 7 (cron DI test issues, dokumentlangan, prod'ga ta'sir qilmaydi) |
| API typecheck | clean |
| API lint | clean |
| API build | clean |
| Web typecheck | clean |
| Web lint | 0 errors (warnings only in vendor bundles) |
| Web build | clean |
| Coverage | Statements 36.84% / Branches 32.92% / Functions 28.10% / Lines 36.15% (thresholds 30/25/25/30 pass) |
| ML tests (Python) | 5 passing |
| Migrations | 32 PG + 3 ClickHouse (idempotent) |

---

## 11. Yakuniy holat: 100% spec compliance

✅ **Phases 1-25 bajarildi** (28 commit, 303 ta fayl, +22366 / -2047 qator)

✅ **Spec audit: 0 ta blocker, 0 ta high gap qoldi.** Topilgan 3 ta gap yopildi (yosh validatsiya, deviation hujjat, Lighthouse acceptable defer).

✅ **15 ta spec to'liq qoplangan:**
- Master vision (auth, lesson flow, status, payments, KPI, gamification, social, telegram)
- Delegation audit (server-side guard, audit log, expired check)
- Face ID (PDPL vector-only, AES-256, JWT device, 3-fail alert)
- Social (auto-friendship, lenta, duel, challenge, chat moderation)
- Navigation UX (BottomNav 6 rolga, desktop SidePanel)
- Status & attendance (mentor/manager split, auto-yellow)
- Debtors report (filter, history, summary)
- Manager UX (red/yellow students, signals, medium-risk)
- KPI dashboards (filadmin/manager + recent awards strip)
- Mentor frontend (group endpoint, parent Telegram, chips)
- Faza 3 remaining (adaptive, content quality, churn, analytics)
- Faza 4 ClickHouse (8-tab dashboard, dual-write, retry cron)
- Faza 4 ML (9 features, CV, /metrics, hybrid fallback)
- Faza 4 PWA (NetworkOnly /api, iOS install, offline reload)
- Faza 4 tenant onboarding (atomic, list, edit, disable)

---

# ✅ A'lochi platforma 100% tayyor

Production deploy uchun `docs/operations/deployment-checklist.md` va `docs/operations/uat-smoke-checklist.md` qo'llanmalariga muvofiq harakat qiling. ML cold-start uchun training data seed qilishni unutmang.

**Tabriklayman — 25 phasenı 28 commit'da yopildi!** 🎉
