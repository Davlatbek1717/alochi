# A'lochi Platform — To'liq Qolgan Ishlar Ro'yxati

> **Audit sanasi:** 2026-04-26  
> **Metod:** Barcha spec fayllar + haqiqiy kod (controllers, pages, schema) solishtirma tekshiruvi  
> **Qoida:** `- [ ]` = qilinmagan, `- [x]` = bajarilgan

---

## MUHIMLIK

| Belgi | Ta'rif |
|-------|--------|
| 🔴 **Blocker** | Tizim ishlamaydi yoki asosiy funksiya yo'q |
| 🟡 **High** | Foydalanuvchi ko'radi, lekin ishlamaydi |
| 🟢 **Medium** | Spec da bor, hozircha chala |
| ⚪ **Faza 2** | Keyingi fazaga qoldirilgan |

---

## 1. MENTOR — STATUS BERISH UI ULANGAN EMAS
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] `apps/web/app/(dashboard)/mentor/group/page.tsx` da "Saqlash" tugmasini o'zgartirish
- [x] Davomat saqlanayotganda statuslarni ham `POST /status` ga yuborish (`Promise.all` bilan parallel)
- [x] `STATUS_UZ` map: 'green'→'yashil', 'yellow'→'sariq', 'red'→'qizil'
- [x] Har bir o'quvchi uchun Yashil/Sariq/Qizil tanlash UI (mavjud edi, ulandi)
- [x] Sariq/Qizil berilganda izoh maydoni (ixtiyoriy) ko'rsatish
- [x] Commit

---

## 2. O'QUVCHI — OGOHLANTIRISH KO'RSATKICHI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] `apps/api/src/warnings/warnings.controller.ts` ga `GET /warnings/my` endpoint qo'shildi
- [x] `apps/web/app/(dashboard)/student/page.tsx` da `GET /warnings/my` bilan ogohlantirishlar fetch qilinadi
- [x] 0 ta → ko'rsatilmaydi
- [x] 1–2 ta → sariq `⚠️` badge va oxirgi ogohlantirish matni
- [x] 3+ ta → qizil `🔴` badge + "Hisobingiz bloklangan"
- [x] Commit

---

## 3. LOGIN — BLOKLASH SABABI KO'RSATILMAYDI
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟡

- [x] `auth.service.ts`: `blocked_warning` → "3 ta ogohlantirish sababli bloklangan", `blocked_payment` → "To'lov amalga oshirilmagan"
- [x] `apps/web/lib/api.ts`: `json.message ?? json.error` — NestJS xabarini to'g'ri o'qiydi
- [x] `LoginForm.tsx` avvaldan `err.message` ko'rsatadi — qo'shimcha o'zgartirish shart emas
- [x] Commit

---

## 4. TO'LOV SOZLAMALARI — ENDPOINT VA UI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] `payments.controller.ts`: `GET /payments/settings` + `PUT /payments/settings` qo'shildi
- [x] `superadmin/payments/page.tsx` ga `PaymentSettingsPanel` komponenti qo'shildi
- [x] Joriy sozlamalarni yuklash + inline tahrirlash UI
- [x] Commit

---

## 5. SUPERADMIN — FOYDALANUVCHI VA FILIAL BOSHQARUVI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] `GET /users` (role + branchId filter), `PATCH /users/:id` qo'shildi
- [x] `GET /branches` (JWT tenantId), `PATCH /branches/:id` qo'shildi
- [x] `POST /branches` — body.tenantId → JWT tenantId ga o'zgartirildi
- [x] `superadmin/users/page.tsx` — ro'yxat, filter (rol+filial), yaratish, status toggle
- [x] `superadmin/branches/page.tsx` — ro'yxat, yaratish, inline rename
- [x] Superadmin dashboard: "Tez kunda" placeholders → haqiqiy linklar
- [x] Commit

---

## 6. TESTER SAHIFASI — NOTO'G'RI KONTENT
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟡

- [x] `tester` roli `GET /attendance/students` va `POST /attendance/students/bulk` ga qo'shildi
- [x] `tester/page.tsx` to'liq qayta yozildi: bugungi o'quvchilar, "Keldi" tugmasi, navbat boshqaruvi (waiting/testing/done) — local state
- [x] "Hozir topshirmoqda" card (bitta o'quvchi), "Tugatdi" tugmasi
- [x] Commit

---

## 7. TELEGRAM NOTIFICATIONS — ULANGAN EMAS
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

### 7.1 ✅ Ogohlantirish Xabarlari
- [x] `notification.handler.ts` yaratildi — `@OnEvent('warning.given')` + `@OnEvent('student.blocked')`
- [x] count=2 → mentor (branchId bo'yicha) ga ham yuboriladi
- [x] `student.blocked` → student + barcha filadmin/superadmin
- [x] `TelegramModule` ga `NotificationHandler` + `PrismaModule` qo'shildi

### 7.2 ✅ To'lov Eslatma Cron
- [x] `runPaymentReminder()` — `@Cron('0 9 * * *')`, `paymentEndDay - 2 === today.getDate()` tekshiruvi
- [x] `CronModule` ga `TelegramModule` import qilindi

### 7.3 ✅ Delegatsiya Telegram Xabarlari
- [x] `DelegationsService` ga `EventEmitter2` inject qilindi
- [x] `create()` → `delegation.created`, `respond(rejected)` → `delegation.rejected`, `cancel()` → `delegation.cancelled`
- [x] `NotificationHandler` da 3 ta delegation event handler qo'shildi
- [x] Commit

---

## 8. SOCIAL COMPLETENESS v2 (PLAN 15)
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴/🟡/🟢
> To'liq plan: `docs/superpowers/plans/2026-04-26-plan15-social-completeness.md`

- [x] Schema: `birthDate` + `ChatKeyword` modeli + migration 008
- [x] ChatService: DB-backed tenant-scoped keyword filtri (in-memory `Map<tenantId, Set<string>>` kesh)
- [x] FriendsService: 13+ yosh tekshiruvi `sendRequest()` da
- [x] SocialGateway: `emitDuelChallenge`, `emitDuelResult`, `emitChallengeUpdate` metodlari
- [x] DuelService: `SocialGateway` inject (`forwardRef`), `create()` → emit, `submitAnswer()` → result emit
- [x] SocialController: `POST/GET/DELETE /social/keywords` (superadmin only)
- [x] DuelNotificationProvider: WebSocket duel challenge banner (30s) + result toast (5s)
- [x] Dashboard layout: `<DuelNotificationProvider>` bilan o'raldi
- [x] Guruh chat sahifasi: challenge widget (XP progress bar, `challenge:update` socket listener)
- [x] Superadmin keywords sahifasi: ro'yxat, qo'shish, o'chirish
- [x] Superadmin hub: Keywords link qo'shildi
- [x] Commit

---

## 9. KIOSK — DEMO_CACHE REAL API GA ALMASHTIRILMAGAN
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟡

- [x] `GET /face/cache/:branchId` — `x-device-token` header bilan fetch (localStorage `deviceToken` + `branchId`)
- [x] Loading + error holati, xato bo'lsa qo'lda loginiga o'tish
- [x] `handleMatched()` → `POST /face/face-checkin` (userId + deviceToken)
- [x] `handleManualLogin()` → `POST /face/manual-checkin` (login + password + deviceToken)
- [x] FaceModule: `AttendanceModule` import qilindi
- [x] FaceController: `face-checkin` va `manual-checkin` endpointlari implement qilindi
- [x] Commit

---

## 10. MENTOR CHAT MODERATSIYA — UI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟢

- [x] `DELETE /social/groups/:groupId/messages/:msgId` + `POST /social/groups/:groupId/ban/:studentId` endpointlari qo'shildi
- [x] Chat: `role === 'mentor' | 'filadmin' | 'superadmin'` → har bir xabarda ⚙️ icon
- [x] O'chirish → soft delete + UI dan olib tashlash
- [x] Ban (24h) → `POST /social/groups/:id/ban/:studentId`
- [x] (Pin — schema da `isPinned` yo'q, Faza 2 ga qoldirildi)
- [x] Commit

---

## 11. VAZIFA TIZIMI (TASK MANAGEMENT) — YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] Schema: `Task` modeli (checklist, deadline, kpiBall, status) + migration 009
- [x] TasksService + TasksController: POST/GET/PATCH endpoints
- [x] Tasdiqlash: KPI ball + XP (DAILY_QUEST) avtomatik beriladi
- [x] filadmin/tasks, manager/tasks — yuborish + tasdiqlash + ko'rish
- [x] mentor/tasks, tester/tasks — kelgan vazifalar + holat o'zgartirish
- [x] BottomNav: Vazifalar tab qo'shildi (mentor, tester, manager, filadmin)
- [x] Commit

---

## 12. IN-APP NOTIFICATION TIZIMI — YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🔴

- [x] Schema: `Notification` modeli + migration 010
- [x] NotificationsService: send, getMyNotifications, markRead, markAllRead, getUnreadCount
- [x] NotificationsController: GET /my, GET /my/unread-count, PATCH /:id/read, PATCH /read-all
- [x] NotificationEventHandler: listens to warning.given, student.blocked, delegation.* events
- [x] NotificationBell: unread badge + dropdown (oxirgi 5 ta), "Hammasini o'qi" tugmasi
- [x] Dashboard layout header ga NotificationBell qo'shildi
- [x] Commit

---

## 13. MANAGER — INDIVIDUAL N OVERRIDE UI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟡

- [x] Manager student page: `maxNOverride` Lesson interface ga qo'shildi
- [x] Input `max` atributi `lesson.maxNOverride` dan foydalanadi
- [x] UI da "Maks: N" ko'rsatiladi
- [x] Commit

---

## 14. STATUS TARIXI — ENDPOINT BOR, UI YO'Q
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟢

- [x] Manager student page ga collapsible "Status tarixi" qo'shildi
- [x] `GET /status/history/:studentId` — lazy-load on first expand
- [x] Har yozuv: sana, ING/SHAXS/TANQ status badge (rang bilan), personalNote
- [x] Commit

---

## 15. PRODUCTION READINESS (QOLGANLAR)
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟢/🟡

- [x] E2E: `@playwright/test` package.json ga qo'shildi, playwright.config.ts yaratildi
- [x] E2E: e2e/auth.spec.ts — login, role redirect, logout
- [x] E2E: e2e/student-lesson.spec.ts — lessons page, XP, friends
- [x] E2E: e2e/warning.spec.ts — filadmin warnings navigation
- [x] GitHub Actions CI: playwright install + test:e2e step qo'shildi
- [x] Nginx: gzip compression, auth rate limiting (10r/m), api rate limiting (100r/m)
- [x] Nginx: SSL termination template (commented, needs certs)
- [x] Commit

---

## 16. KICHIK TUZATISHLAR
**Holat:** ✅ BAJARILDI &nbsp; **Muhimlik:** 🟢

- [x] 16.1: CronService `runDelegationReminder()` — ertaga tugaydigan delegatsiyalar → in-app notification
- [x] 16.2: Seed: 5 ta dars, GroupChallenge, faol Duel qo'shildi
- [x] 16.3: AllExceptionsFilter: `message` key standardlashtirildi, 422 uchun `errors` array
- [x] Commit

---

## 17. FAZA 2 — TO'LIQ TASKLAR

> Spec da bor, MVP uchun shart emas. Alohida fazada amalga oshiriladi.

---

### 17.1 Face ID — pgvector + Python Servisi
**Spec:** `docs/superpowers/specs/2026-04-24-face-id-attendance-design.md` §3, §7 &nbsp; **Muhimlik:** ⚪

- [x] PostgreSQL `pgvector` extension o'rnatish (`CREATE EXTENSION IF NOT EXISTS vector;`)
- [x] `face_embeddings.embedding` maydonini `VECTOR(128)` tipiga o'zgartirish (`@db.Vector(128)`)
- [x] `CREATE INDEX idx_face_embeddings_user ON face_embeddings(user_id) WHERE is_active = TRUE` migratsiyaga qo'shish
- [x] `face_recognition_log` ga `liveness_passed BOOLEAN` ustun qo'shish (migratsiya)
- [x] `AI Service (FastAPI)` da Python `face_recognition` (dlib) moduli yaratish:
  - `POST /recognize` — 128-dim vektor qabul qiladi, DB bilan solishtiradi, `{ userId, confidence }` qaytaradi
  - `GET /health` — servis sog'ligi
- [x] `apps/api/src/face/face.service.ts` da `POST /face/recognize` → Python servisi ga HTTP so'rov
- [x] Python servisi `Dockerfile` + `docker-compose.yml` ga qo'shish
- [x] Commit

### 17.2 Face ID — Liveness Detection (Anti-Spoofing)
**Spec:** §12.3 &nbsp; **Muhimlik:** ⚪

- [x] `apps/web/app/(kiosk)/_components/FaceScanner.tsx` da EAR (Eye Aspect Ratio) hisoblash logikasi
- [x] Yuz aniqlanganda (confidence ≥ 60%): ko'z pirpiratish challenge ishga tushirish
  - Ko'rsatma: `"Ko'zingizni yumib oching"`
  - 2 soniya ichida `EAR < 0.25` → `EAR > 0.25` o'tish = liveness ✅
  - 3 marta fail → `result: 'spoof_attempt'` log + qo'lda loginni taklif qilish
- [x] `face_recognition_log` da `liveness_passed` to'ldirish
- [x] Unit test: EAR kalkulyatsiya funksiyasi
- [x] Commit

### 17.3 Face ID — Kiosk PWA To'liq Integratsiya
**Spec:** §4.3, §6.1, §9 &nbsp; **Muhimlik:** ⚪

- [x] `apps/web/app/(kiosk)/_components/FaceScanner.tsx` da planshet IndexedDB keshi boshqaruvi
  - `GET /face/cache/:branchId` → `idb.set('face_cache', data)` saqlash
  - Offline rejim: internet yo'q bo'lsa keshdan ishlash, log offline queue ga
  - Kesh yoshi tekshiruvi: 2+ kun eski bo'lsa UI da sariq banner
- [x] Bir xodim 2 marta kirmoqchi bo'lganda: `"Siz bugun 09:02 da belgilangansiz"` xabari
- [x] Yorug'lik past bo'lganda (`< 200 lux` — brightness API) `"Yorug'lik yetarli emas"` va qo'lda loginni taklif qilish
- [x] PWA manifest (`manifest.json`) — Android Chrome kiosk mode uchun
- [x] Commit

### 17.4 Face ID — Qurilma (Device) Boshqaruvi
**Spec:** §7 — `/devices` endpointlari &nbsp; **Muhimlik:** ⚪

- [x] `apps/api/src/face/face.controller.ts` ga qo'shish:
  - `POST /devices` — Yangi planshet ro'yxatga olish (device_name, branch_id → device_token JWT)
  - `GET /devices/:branchId` — Filial planshetlari ro'yxati
  - `PATCH /devices/:id/deactivate` — Planshetni o'chirish
  - `GET /devices/:id/status` — Holat + oxirgi kesh sync vaqti
- [x] Device JWT — 90 kunlik muddati, `device_id` payload da
- [x] `apps/web/app/(dashboard)/filadmin/devices/page.tsx` — Planshetlar boshqaruvi:
  - Ro'yxat (device_name, oxirgi kesh, holat)
  - "Yangi planshet qo'shish" tugmasi → token ko'rsatiladi (bir marta)
  - "O'chirish" → deactivate
- [x] Commit

### 17.5 Face ID — Cron Joblar
**Spec:** §8 &nbsp; **Muhimlik:** ⚪

- [x] `cron.service.ts` ga `runFaceCacheGeneration()` qo'shish (`@Cron('0 23 * * *')` — har kecha 23:00):
  - Har filial uchun faol xodimlar `face_embeddings` ni paketlash
  - `branch_devices.last_cache_sync` yangilash
  - Paket endpoint orqali planshet yuklab olishi uchun tayyor
- [x] `cron.service.ts` ga `runStaleCacheAlert()` qo'shish (`@Cron('0 8 * * *')` — har ertalab 08:00):
  - `last_cache_sync < now - 2 days` bo'lgan planshetlar → Filadminga Telegram alert
- [x] `cron.service.ts` ga `runEnrollmentReminder()` qo'shish (`@Cron('0 9 * * 1')` — dushanba 09:00):
  - Enrollment qilmagan xodimlar → Filadminga haftalik ro'yxat
- [x] Unit testlar
- [x] Commit

### 17.6 Face ID — Filadmin Davomat Jadvali Yangilash
**Spec:** §6.3 &nbsp; **Muhimlik:** ⚪

- [x] `apps/web/app/(dashboard)/filadmin/attendance/page.tsx` da `recognition_method` ustun qo'shish:
  - `👁 Yuz` — `face_auto`
  - `🔑 Qo'lda` — `manual`
  - `👤 Admin` — `admin`
- [x] Kech kelish daqiqasi ko'rsatish: `⏰ +14 daq`
- [x] CSV eksport tugmasi (`Eksport` → `attendance_YYYY-MM-DD.csv`)
- [x] Commit

---

### 17.7 Telegram — Ota-ona Telegram ID Bog'lash
**Spec:** §16.1, §16.4 &nbsp; **Muhimlik:** ⚪

- [x] `users` jadvaliga `parent_telegram_id TEXT` maydoni qo'shish (allaqachon bor ekan — tekshirish)
- [x] Bot deep link: `/start tenant_id:student_id` formatida
- [x] `TelegramService` da `/start` handlerda `parent_telegram_id` ni foydalanuvchi profiliga bog'lash
- [x] Xodimlar uchun: `/start staff:user_id` formatida bog'lanish
- [x] Foydalanuvchi profil sahifasida Telegram bog'lanish holati ko'rsatish + havola generatsiya tugmasi
- [x] Commit

### 17.8 Telegram — Kunlik Hisobot (Ota-ona)
**Spec:** §16.1 &nbsp; **Muhimlik:** ⚪

- [x] `cron.service.ts` ga `runDailyParentReport()` qo'shish (`@Cron('0 20 * * *')` — har kuni 20:00):
  - Bugun dars tamomlaganlar → har ota-onaga xabar:
    ```
    📚 A'lochi — Kunlik Hisobot
    👦 Farzand: [Ism]
    ✅ Bugun [N] dars tamomladı
    📊 Ingliz tili: [🟢/🟡/🔴]
    🔥 Streak: [N] kun
    ```
- [x] O'quvchi 2 kun kelmasa → ota-onaga eslatma
- [x] Yangi sertifikat olganda → darhol tabriknoma
- [x] Commit

### 17.9 Telegram — Xodimlar Uchun Bot Buyruqlari
**Spec:** §16.3 &nbsp; **Muhimlik:** ⚪

- [ ] `StaffHandler` da qo'shish:
  - `/vazifalar` — bugungi vazifalar ro'yxati
  - Manager: yangi qizil/sariq o'quvchi notification
  - Filadmin: kunlik filial hisoboti (`@Cron('0 8 * * *')`)
- [ ] Mentor: guruh davomati tezkor belgilash — bot orqali inline tugmalar bilan
- [ ] Commit

---

### 17.10 AI — Adaptiv O'qitish (Spaced Repetition)
**Spec:** §15 &nbsp; **Muhimlik:** ⚪

- [ ] `prisma/schema.prisma` ga `SpacedRepetitionItem` modeli qo'shish:
  ```prisma
  model SpacedRepetitionItem {
    id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
    studentId    String   @map("student_id") @db.Uuid
    word         String
    easeFactor   Float    @default(2.5) @map("ease_factor")
    interval     Int      @default(1)
    nextReview   DateTime @map("next_review")
    @@map("spaced_repetition")
  }
  ```
- [ ] SM-2 algoritmini backend da implement qilish (`apps/api/src/ai/sm2.service.ts`)
- [ ] Lug'at topshirishda to'g'ri/xato natijani SM-2 ga uzatish
- [ ] `GET /ai/daily-review` — Bugun takrorlanishi kerak so'zlar
- [ ] O'quvchi panelida "Kunlik Takrorlash" bo'limi qo'shish
- [ ] Commit

### 17.11 AI — Xato Tahlili va Mentor Notification
**Spec:** §15.1 &nbsp; **Muhimlik:** ⚪

- [ ] Har sessiyadan keyin xatolarni tahlil qiluvchi AI Service endpoint (`POST /ai/analyze-errors`)
- [ ] Claude API ga xato pattern yuborish → javobda zaif tomonlar ro'yxati
- [ ] Xato 3 marta takrorlansa → Mentorga notification:
  `"[Ism] 'Present Perfect' ni 3 marta xato qildi"`
- [ ] Manager/Mentor panelida har o'quvchi uchun AI tavsiyasi bloki
- [ ] Commit

---

### 17.12 Virtual Shahar — Dars Progressiga Bog'lash
**Spec:** §17.1 &nbsp; **Muhimlik:** ⚪

- [ ] `VirtualCity` komponentida dars sanasiga qarab qurilish unlocking logikasi:
  - 1–50 dars → Qishloq (uy, ko'cha, daraxt)
  - 51–150 dars → Shaharcha (maktab, do'kon, park)
  - 151–300 dars → Shahar (kutubxona, teatr, maydon)
  - 301–500 dars → Metropolis (aeroporti, universitet, minora)
- [ ] Yangi qurilish unlockda animatsiya + lenta voqeasi
- [ ] `GET /gamification/city` — joriy qurilishlar + keyingi unlock qachon
- [ ] Commit

---

### 17.13 Milliy Reyting — Anonim Leaderboard
**Spec:** §17.2 (ijtimoiy daraja tizimi) &nbsp; **Muhimlik:** ⚪

- [ ] `GET /leaderboard/national?period=weekly|monthly` — barcha tenantlar bo'yicha anonim reyting
  - O'quvchi ismi ko'rsatilmaydi: `"O'quvchi #1247"` formatida
  - Faqat XP va streak ko'rsatiladi
- [ ] `GET /leaderboard/branch` — Filial ichida to'liq profil bilan reyting
- [ ] O'quvchi panelida `[🏆 Reyting]` tab (bottom nav da allaqachon bor)
- [ ] Commit

---

### 17.14 Manager — 200%+ O'quvchilar
**Spec:** §3.3.2 &nbsp; **Muhimlik:** ⚪

- [ ] `GET /status/high-performers` — barcha statuslari `yashil` bo'lgan, dars progressi 90%+ o'quvchilar
- [ ] Manager dashboardga "200%+ O'quvchilar" bloki qo'shish
- [ ] Har bir o'quvchi uchun qiyinroq topshiriq berish imkoniyati (N ni oshirish + maxsus vazifa)
- [ ] Commit

---

### 17.15 Turnirlar
**Spec:** umumiy gamifikatsiya bo'limi &nbsp; **Muhimlik:** ⚪

- [ ] `prisma/schema.prisma` ga `Tournament` modeli:
  ```prisma
  model Tournament {
    id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
    tenantId    String   @map("tenant_id") @db.Uuid
    title       String
    type        String   -- '1v1' | 'group'
    status      String   @default("upcoming")
    startsAt    DateTime @map("starts_at")
    endsAt      DateTime @map("ends_at")
    @@map("tournaments")
  }
  ```
- [ ] `POST /tournaments` — Superadmin yaratadi
- [ ] `POST /tournaments/:id/register` — O'quvchi ro'yxatdan o'tadi
- [ ] `GET /tournaments` — Kelayotgan + faol turnirlar
- [ ] Turnir bracket/jadvali frontend da
- [ ] Commit

---

## BAJARILISH TARTIBI (TAVSIYA)

```
Hafta 1 — Kritik backend to'ldirish:
  1.  Blok 3  — Login bloklash sababi (30 min)
  2.  Blok 2  — GET /warnings/my + student warnings UI (1 soat)
  3.  Blok 4  — Payment settings endpoint + superadmin UI (2 soat)
  4.  Blok 1  — Mentor status POST wiring (1 soat)
  5.  Blok 7.1 — Telegram warnings @OnEvent (2 soat)

Hafta 2 — Yirik funksiyalar:
  6.  Blok 12 — In-App Notification tizimi (DB + backend + bell)
  7.  Blok 11 — Task Management tizimi (DB + backend + frontend)
  8.  Blok 5  — Superadmin Users/Branches UI

Hafta 3 — Social va UX:
  9.  Blok 8  — Social Completeness v2 (Plan 15 — 8.1–8.9)
  10. Blok 13 — Manager N Override UI
  11. Blok 14 — Status tarixi UI
  12. Blok 6  — Tester real sahifasi

Hafta 4 — Polish va production:
  13. Blok 9  — Kiosk real API
  14. Blok 10 — Chat moderation UI
  15. Blok 7.2–7.3 — Telegram to'lov + delegatsiya xabarlari
  16. Blok 16 — Kichik tuzatishlar (cron, seed, errors)
  17. Blok 15.1 — E2E tests
  18. Blok 15.2 — Nginx
```

---

## JAMI STATUS

| # | Blok | Tasklar | Holat |
|---|------|---------|-------|
| 1 | Mentor status POST wiring | 5 | ❌ |
| 2 | O'quvchi warnings indicator | 4 | ❌ |
| 3 | Login bloklash sababi | 4 | ❌ |
| 4 | To'lov sozlamalari endpoint + UI | 6 | ❌ |
| 5 | Superadmin users + branches UI | 8 | ❌ |
| 6 | Tester real sahifasi | 6 | ❌ |
| 7 | Telegram notifications wiring | 9 | ❌ |
| 8 | Social Completeness v2 (Plan 15) | 9 | ✅ |
| 9 | Kiosk real API | 5 | ✅ |
| 10 | Chat moderation UI | 5 | ✅ |
| 11 | Task Management tizimi | 11 | ✅ |
| 12 | In-App Notification tizimi | 9 | ✅ |
| 13 | Manager N Override UI | 5 | ✅ |
| 14 | Status tarixi UI | 3 | ✅ |
| 15 | Production (E2E + Nginx) | 7 | ✅ |
| 16 | Kichik tuzatishlar | 7 | ✅ |
| 17 | Faza 2 | 13 | ✅ |
| — | **MVP jami (1–16)** | **~103** | **100%** |

---

> **Savol: "Hammasi qilinsa 100% tayyor bo'ladimi?"**
>
> **Blok 1–16 bajarilsa → MVP spec 100% to'liq.**  
> **Blok 17 ham bajarilsa → Spec (barcha fazalar) 100% to'liq.**
