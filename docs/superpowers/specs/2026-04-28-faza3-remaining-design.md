# Faza 3 Qolgan Subsystemlar — Dizayn Spesifikatsiyasi

**Sana:** 2026-04-28
**Versiya:** 1.0
**Qamrov:** Adaptiv qiyinlik, Kontent sifat nazorati + A/B test, Churn prediction (rule-based), Analytics (PostgreSQL)
**Yondashuv:** Yondashuv A — Docker kerak emas, joriy PostgreSQL 18 infra bilan ishlaydi

---

## 1. ADAPTIV QIYINLIK MOSLASHISHI

### 1.1 Maqsad
O'quvchining xato darajasiga qarab dars takrorlash sonini (`nRepetitionsOverride`) avtomatik oshiradi yoki kamaytiradi. Mentor qo'lda o'zgartirmasdan ham tizim o'zini moslashtiradi.

### 1.2 Algoritm
Har kecha 03:00 da cron ishlaydi. Har bir faol o'quvchi uchun **oxirgi 7 kundagi** xato foizi hisoblanadi:

```
errorRate = errorCount / totalQuestions  (oxirgi 7 kun)

errorRate > hardThreshold (default 40%) → nRepetitionsOverride += 1  (lekin max N dan oshmasin)
errorRate < easyThreshold (default 15%) → nRepetitionsOverride -= 1  (lekin min N dan pasaymasin)
15% ≤ errorRate ≤ 40%                   → hech narsa o'zgarmaydi
```

Agar o'quvchi uchun `StudentLessonConfig` yo'q bo'lsa — yangi yozuv yaratiladi (`nRepetitionsOverride = lesson.nRepetitions`).

### 1.3 Yangi Jadvallar

```prisma
model AdaptiveDifficultyConfig {
  id              String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId        String  @unique @map("tenant_id") @db.Uuid
  minN            Int     @default(1) @map("min_n")
  maxN            Int     @default(10) @map("max_n")
  hardThreshold   Float   @default(0.40) @map("hard_threshold")
  easyThreshold   Float   @default(0.15) @map("easy_threshold")
  updatedAt       DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@map("adaptive_difficulty_configs")
}

model AdaptiveDifficultyLog {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @map("student_id") @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  oldN      Int      @map("old_n")
  newN      Int      @map("new_n")
  errorRate Float    @map("error_rate")
  changedAt DateTime @default(now()) @map("changed_at")

  student User   @relation("AdaptiveLogs", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson @relation("AdaptiveLogs", fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([studentId])
  @@map("adaptive_difficulty_logs")
}
```

### 1.4 Backend

**Yangi fayl:** `apps/api/src/adaptive/adaptive.service.ts`
- `runNightlyAdaptation(tenantId)` — bir tenant uchun barcha faol o'quvchilarni ko'rib chiqadi
- `getAdaptiveConfig(tenantId)` — tenant konfigini qaytaradi (yo'q bo'lsa default yaratadi)
- `updateAdaptiveConfig(tenantId, dto)` — superadmin sozlamalarini yangilaydi

**Yangi fayl:** `apps/api/src/adaptive/adaptive.controller.ts`
- `GET /adaptive/config` — tenant konfig (superadmin)
- `PATCH /adaptive/config` — tenant konfig yangilash (superadmin)
- `GET /adaptive/logs/:studentId` — o'quvchi uchun tarix (mentor, manager, superadmin)

**`apps/api/src/cron/cron.service.ts` — yangi cron:**
```typescript
@Cron('0 3 * * *', { name: 'adaptive_difficulty' })
async runAdaptiveDifficulty()
```

### 1.5 Frontend

**`apps/web/app/(dashboard)/superadmin/adaptive/page.tsx`** — Superadmin sozlamalar sahifasi:
- Min N, Max N, Hard threshold %, Easy threshold % inputlar
- "Saqlash" tugmasi
- Oxirgi adaptatsiya vaqti ko'rsatiladi

### 1.6 Ma'lumot Manbalari
- `ErrorLog` jadval (allaqachon mavjud) — xato hisobi uchun
- `StudentLessonConfig` jadval (allaqachon mavjud) — N override saqlash uchun

---

## 2. KONTENT SIFAT NAZORATI + A/B TEST

### 2.1 Maqsad
Superadmin qaysi darslar yaxshi o'tishini, qaysilari muammoli ekanini real-time ko'radi. O'quvchi fikr bildiradi. Muammoli dars uchun B versiyasini yaratib, natijalar taqqoslanadi.

### 2.2 Yangi Jadvallar

```prisma
model LessonFeedback {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @map("student_id") @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  rating    Int      -- 1=qiyin, 2=o'rtacha, 3=tushunarli
  createdAt DateTime @default(now()) @map("created_at")

  student User   @relation("LessonFeedbacks", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson @relation("LessonFeedbacks", fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@map("lesson_feedbacks")
}

model LessonVariant {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  lessonId    String   @map("lesson_id") @db.Uuid
  variant     String   -- 'A' yoki 'B'
  isActive    Boolean  @default(true) @map("is_active")
  config      Json     -- {nRepetitions, componentIds, description}
  createdAt   DateTime @default(now()) @map("created_at")

  lesson      Lesson   @relation("LessonVariants", fields: [lessonId], references: [id], onDelete: Cascade)
  assignments StudentVariantAssignment[]

  @@unique([lessonId, variant])
  @@map("lesson_variants")
}

model StudentVariantAssignment {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @map("student_id") @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  variantId String   @map("variant_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at")

  student User          @relation("VariantAssignments", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson        @relation("VariantAssignments", fields: [lessonId], references: [id], onDelete: Cascade)
  variant LessonVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@map("student_variant_assignments")
}
```

### 2.3 Pass Rate Hisoblash

`StudentProgress` jadvalidan:
```sql
passRate = COUNT(*) FILTER (WHERE academy_completed = true) 
           / NULLIF(COUNT(DISTINCT student_id), 0)
```

Pass rate < 50% bo'lganda — superadminga notification yuboriladi (birinchi marta va keyinchalik har haftada bir).

### 2.4 Backend

**Yangi fayl:** `apps/api/src/content-quality/content-quality.service.ts`
- `getLessonStats(tenantId)` — barcha darslar uchun pass rate, avg sessions, feedback avg
- `submitFeedback(studentId, lessonId, rating)` — o'quvchi fikri
- `createVariant(lessonId, config)` — B variant yaratish
- `getVariantForStudent(studentId, lessonId)` — assignment (yo'q bo'lsa random yaratadi: 50/50)
- `getABResults(lessonId)` — A va B versiyalar natijasini taqqoslaydi
- `promoteVariant(lessonId, winner)` — G'olib variant asosiy bo'ladi

**Yangi fayl:** `apps/api/src/content-quality/content-quality.controller.ts`
- `GET /content-quality/lessons` — darslar statistikasi (superadmin)
- `POST /content-quality/feedback` — feedback yuborish (student)
- `POST /content-quality/lessons/:id/variant` — B variant yaratish (superadmin)
- `GET /content-quality/lessons/:id/ab-results` — A/B natijalar (superadmin)
- `POST /content-quality/lessons/:id/promote/:variant` — variant tanlash (superadmin)

### 2.5 Frontend

**`apps/web/app/(dashboard)/superadmin/content-quality/page.tsx`** — Darslar samaradorligi:
- Jadval: Dars nomi | Pass rate | Feedback avg | O'rtacha sessiya | Status
- Pass rate < 50% → qizil qator
- Har bir qatorda "A/B test boshlash" tugmasi
- A/B natijalar modali (bitta qatorni kengaytirsa chiqadi)

**Feedback widget** — `apps/web/app/(dashboard)/student/lessons/[id]/_components/FeedbackWidget.tsx`:
- Dars akademiyasi tamomlanganidan keyin chiqadi (ixtiyoriy)
- 3 ta emoji tugma: 😊 😐 😕
- Faqat bir marta ko'rsatiladi (localStorage + DB unique constraint)

---

## 3. CHURN PREDICTION (Rule-based Scoring)

### 3.1 Maqsad
Har kuni faol o'quvchilar uchun risk balli hisoblanadi (0–100). Yuqori balllilar manager panelida ko'rsatiladi, birinchi marta xavfli zonaga tushganda notification yuboriladi.

### 3.2 Scoring Algoritmi

| Signal | Ball | Tekshirish usuli |
|--------|------|------------------|
| 3+ kun kelmadi (davomat yo'q) | +30 | `AttendanceStudent` da oxirgi 3 kun yo'q |
| Streak = 0 (uzildi) | +20 | `StudentXp.currentStreak = 0` |
| Pass rate oxirgi haftada 20%+ tushdi | +25 | `StudentProgress` haftalik taqqoslash |
| Joriy status Qizil (ingliz yoki shaxsiy) | +25 | `StudentStatus` oxirgi yozuv |
| Ota-ona Telegram bog'lanmagan | +10 | `User.parentTelegramId IS NULL` |

Maksimum yig'indi 110 → `score = min(rawScore, 100)`

**Darajalar:**
- 0–30: Xavfsiz (yashil)
- 31–60: Diqqat talab qiladi (sariq)
- 61–100: Yuqori xavf (qizil)

### 3.3 Yangi Jadvallar

```prisma
model ChurnScore {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId  String   @unique @map("student_id") @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  score      Int      @default(0)
  signals    Json     -- {absent3Days: bool, streakBroken: bool, passRateDrop: bool, redStatus: bool, noParentTg: bool}
  alertSent  Boolean  @default(false) @map("alert_sent")
  updatedAt  DateTime @updatedAt @map("updated_at")

  student User @relation("ChurnScores", fields: [studentId], references: [id], onDelete: Cascade)

  @@index([tenantId, score])
  @@map("churn_scores")
}
```

### 3.4 Backend

**Yangi fayl:** `apps/api/src/churn/churn.service.ts`
- `runDailyScoring(tenantId)` — bir tenant barcha faol o'quvchilari uchun score yangilaydi
- `getHighRiskStudents(tenantId, branchId?)` — score > 60 bo'lgan o'quvchilar
- `getMediumRiskStudents(tenantId, branchId?)` — score 31–60 bo'lganlar

**Yangi fayl:** `apps/api/src/churn/churn.controller.ts`
- `GET /churn/high-risk` — yuqori xavf (manager, filadmin, superadmin)
- `GET /churn/medium-risk` — o'rta xavf (manager, filadmin, superadmin)

**`apps/api/src/cron/cron.service.ts` — yangi cron:**
```typescript
@Cron('0 6 * * *', { name: 'churn_scoring' })
async runChurnScoring()
```

Alert logikasi: `alertSent = false` va `score > 60` bo'lsa — manager ga notification yuboriladi, `alertSent = true` qilinadi. Score 60 dan pastga tushsa — `alertSent = false` qayta tiklanadi (keyingi ko'tarilishda yana xabar ketishi uchun).

### 3.5 Frontend

**Manager dashboard** (`apps/web/app/(dashboard)/manager/page.tsx`) — yangi blok:
```
⚠️ Xavfli O'quvchilar
  Qizil (>60 ball): [ism] — 85 ball — Absent 3d + Red status
  Sariq (31-60):   [ism] — 45 ball — Streak broken
```

**`apps/web/app/(dashboard)/superadmin/churn/page.tsx`** — To'liq churn dashboard:
- Tenant bo'yicha yuqori/o'rta xavf o'quvchilar jadvali
- Signal ko'rsatiladi (qaysi omil sabab)
- Filial bo'yicha filter

---

## 4. ANALYTICS (PostgreSQL-based)

### 4.1 Maqsad
Superadmin uchun platformaning umumiy holati — darslar samaradorligi, o'quvchi faolligi, filiallar taqqoslashini ko'rish imkoniyati. ClickHouse o'rniga PostgreSQL materialized view ishlatiladi.

### 4.2 Event Logging

**Yangi jadval:**
```prisma
model AnalyticsEvent {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  eventType String   @map("event_type")
  studentId String?  @map("student_id") @db.Uuid
  branchId  String?  @map("branch_id") @db.Uuid
  data      Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([tenantId, eventType, createdAt])
  @@index([tenantId, branchId, createdAt])
  @@map("analytics_events")
}
```

**Event types:**
| Type | Qayerdan yoziladi | data fields |
|------|------------------|-------------|
| `lesson_completed` | `progress.service.ts` | lessonId, sessionCount, timeSpentSec |
| `lesson_failed` | `progress.service.ts` | lessonId, sessionCount |
| `attendance_marked` | `attendance-students.service.ts` | isPresent, isLate |
| `streak_updated` | `streak.service.ts` | newStreak, oldStreak |

### 4.3 Materialized Views (PostgreSQL)

```sql
-- Lesson samaradorligi
CREATE MATERIALIZED VIEW lesson_stats_mv AS
SELECT
  sp.lesson_id,
  l.tenant_id,
  COUNT(DISTINCT sp.student_id) AS total_students,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed) AS passed,
  ROUND(COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed)::numeric 
        / NULLIF(COUNT(DISTINCT sp.student_id), 0) * 100, 1) AS pass_rate,
  ROUND(AVG(sp.session_count), 1) AS avg_sessions,
  ROUND(AVG(lf.rating), 2) AS feedback_avg
FROM student_progress sp
JOIN lessons l ON sp.lesson_id = l.id
LEFT JOIN lesson_feedbacks lf ON sp.lesson_id = lf.lesson_id AND sp.student_id = lf.student_id
GROUP BY sp.lesson_id, l.tenant_id;

-- Filial taqqoslash
CREATE MATERIALIZED VIEW branch_stats_mv AS
SELECT
  u.branch_id,
  u.tenant_id,
  COUNT(DISTINCT u.id) AS active_students,
  ROUND(AVG(sx.current_streak), 1) AS avg_streak,
  ROUND(AVG(sx.total_xp), 0) AS avg_xp
FROM users u
JOIN student_xp sx ON u.id = sx.student_id
WHERE u.role = 'student' AND u.status = 'active'
GROUP BY u.branch_id, u.tenant_id;
```

Materialized view har kecha 02:00 da `REFRESH MATERIALIZED VIEW CONCURRENTLY` bilan yangilanadi.

### 4.4 Backend

**Yangi fayl:** `apps/api/src/analytics/analytics.service.ts`
- `getLessonStats(tenantId)` — `lesson_stats_mv` dan
- `getBranchStats(tenantId)` — `branch_stats_mv` dan
- `getStudentActivity(tenantId, period)` — `AnalyticsEvent` dan kunlik/haftalik/oylik faol o'quvchilar

**Yangi fayl:** `apps/api/src/analytics/analytics.controller.ts`
- `GET /analytics/lessons` — darslar statistikasi (superadmin)
- `GET /analytics/branches` — filiallar taqqoslash (superadmin, filadmin)
- `GET /analytics/activity?period=weekly` — o'quvchi faolligi (superadmin)

### 4.5 Frontend

**`apps/web/app/(dashboard)/superadmin/analytics/page.tsx`** — 3 bo'limli sahifa:
1. **Darslar samaradorligi** — jadval: dars nomi, pass rate (progress bar), feedback, sessiya
2. **Filiallar taqqoslash** — jadval: filial, faol o'quvchilar, streak o'rtacha, XP o'rtacha
3. **Faollik grafigi** — so'nggi 30 kunlik faol o'quvchilar (oddiy chiziq grafik, recharts)

---

## 5. FAYL XARITASI

| Fayl | Amal | Maqsad |
|------|------|--------|
| `prisma/schema.prisma` | O'zgartirish | 6 ta yangi model qo'shish |
| `prisma/migrations/0015_adaptive/migration.sql` | Yaratish | adaptive_difficulty_* jadvallar |
| `prisma/migrations/0016_content_quality/migration.sql` | Yaratish | lesson_feedbacks, lesson_variants, student_variant_assignments |
| `prisma/migrations/0017_churn/migration.sql` | Yaratish | churn_scores |
| `prisma/migrations/0018_analytics/migration.sql` | Yaratish | analytics_events + materialized views |
| `apps/api/src/adaptive/adaptive.service.ts` | Yaratish | Adaptatsiya logikasi |
| `apps/api/src/adaptive/adaptive.controller.ts` | Yaratish | Adaptatsiya endpointlari |
| `apps/api/src/adaptive/adaptive.module.ts` | Yaratish | NestJS modul |
| `apps/api/src/content-quality/content-quality.service.ts` | Yaratish | Kontent sifat + A/B test logikasi |
| `apps/api/src/content-quality/content-quality.controller.ts` | Yaratish | Kontent sifat endpointlari |
| `apps/api/src/content-quality/content-quality.module.ts` | Yaratish | NestJS modul |
| `apps/api/src/churn/churn.service.ts` | Yaratish | Churn scoring logikasi |
| `apps/api/src/churn/churn.controller.ts` | Yaratish | Churn endpointlari |
| `apps/api/src/churn/churn.module.ts` | Yaratish | NestJS modul |
| `apps/api/src/analytics/analytics.service.ts` | Yaratish | Analytics logikasi |
| `apps/api/src/analytics/analytics.controller.ts` | Yaratish | Analytics endpointlari |
| `apps/api/src/analytics/analytics.module.ts` | Yaratish | NestJS modul |
| `apps/api/src/cron/cron.service.ts` | O'zgartirish | adaptive (03:00), churn (06:00), refresh MV (02:00) cron lar |
| `apps/api/src/lesson-progress/progress.service.ts` | O'zgartirish | lesson_completed / lesson_failed event yozish |
| `apps/api/src/attendance/attendance-students.service.ts` | O'zgartirish | attendance_marked event yozish |
| `apps/api/src/gamification/streak.service.ts` | O'zgartirish | streak_updated event yozish |
| `apps/api/src/app.module.ts` | O'zgartirish | 4 ta yangi modul ro'yxatdan o'tkazish |
| `apps/web/app/(dashboard)/superadmin/adaptive/page.tsx` | Yaratish | Adaptatsiya sozlamalari |
| `apps/web/app/(dashboard)/superadmin/content-quality/page.tsx` | Yaratish | Darslar samaradorligi + A/B test |
| `apps/web/app/(dashboard)/superadmin/churn/page.tsx` | Yaratish | Churn dashboard |
| `apps/web/app/(dashboard)/superadmin/analytics/page.tsx` | Yaratish | Analytics dashboard |
| `apps/web/app/(dashboard)/student/lessons/[id]/_components/FeedbackWidget.tsx` | Yaratish | Dars oxirida emoji feedback |
| `apps/web/app/(dashboard)/manager/page.tsx` | O'zgartirish | Churn bloki qo'shish |
| `apps/web/app/(dashboard)/superadmin/page.tsx` | O'zgartirish | Yangi nav kartalar qo'shish |

---

## 6. MIGRATSIYA TARTIBI

1. `0015_adaptive` → adaptive_difficulty_configs, adaptive_difficulty_logs
2. `0016_content_quality` → lesson_feedbacks, lesson_variants, student_variant_assignments
3. `0017_churn` → churn_scores
4. `0018_analytics` → analytics_events + materialized views (lesson_stats_mv, branch_stats_mv)
5. `npx prisma generate` — Prisma client yangilash
6. Cron service yangilash
7. Progress/Attendance/Streak service larda event logging qo'shish

---

## 7. TEST STRATEGIYASI

| Test | Maqsad |
|------|--------|
| `adaptive.service.spec.ts` | errorRate threshold logikasi: hardThreshold da +1, easyThreshold da -1, o'rtada 0 |
| `churn.service.spec.ts` | Har bir signal to'g'ri ball berishi; max 100 ga cheklanishi |
| `content-quality.service.spec.ts` | A/B variant 50/50 taqsimlanishi; pass rate hisobi to'g'riligi |
| `analytics.service.spec.ts` | getLessonStats, getBranchStats mock data bilan to'g'ri javob berishi |
