# A'lochi — Face ID Xodim Davomat Tizimi

**Sana:** 2026-04-24
**Versiya:** 1.0
**Loyiha:** A'lochi Platform
**Holat:** Ko'rib chiqilmoqda

---

## 1. MAQSAD

Filial kirishiga o'rnatilgan Android planshet orqali xodimlarning kelishi avtomatik aniqlanadi — qo'lda "Keldim" tugmasini bosish va Filadmin tasdiqlashi kerak emas. Kechikish ham avtomatik hisoblanadi.

---

## 2. QAMROV

- Android planshet kiosk rejimida filial kirishida ishlaydi
- Xodim o'z telefonidan yuzini bir marta ro'yxatdan o'tkazadi
- Yuz aniqlash: planshetda (face-api.js) → ishonch past bo'lsa server (Python face_recognition)
- Yuz ma'lumotlari: server (shifrlangan vektor) + planshetda kunlik kesh (offline rejim)
- Kechikish avtomatik aniqlanadi (ish boshlanish vaqti bilan solishtirish)
- Yuz aniqlanmasa: qo'lda login + Filadminga notification

**Qamrovdan tashqari:**
- Chiqish vaqtini kuzatish (faqat kirish)
- O'quvchilar davomati (bu tizim faqat xodimlar uchun)
- iOS ilova (faqat Android planshet)

---

## 3. TEXNIK STACK

| Komponent | Texnologiya |
|-----------|------------|
| Planshet ilovasi | Progressive Web App (PWA) — Android Chrome kiosk rejimi |
| Yuz aniqlash (planshet) | face-api.js (TensorFlow.js asosida) |
| Yuz aniqlash (server fallback) | Python face_recognition (dlib) — AI Service |
| Enrollment | face-api.js — xodim telefoni brauzeri |
| Vektorlar saqlash | PostgreSQL pgvector extension |
| Kunlik kesh | IndexedDB (planshetda) |

---

## 4. ASOSIY JARAYON

### 4.1 Enrollment (Bir marta, xodim telefonida)

```
Xodim profili → "Yuzimni ro'yxatdan o'tkazish" tugmasi
  ↓
Kamera ochiladi — ko'rsatma: to'g'ri, chapga, o'ngga qarang
  ↓
5 ta rasm olinadi (turli burchak)
  ↓
face-api.js → har bir rasmdan 128 o'lchovli vektor generatsiya
  ↓
5 ta vektor serverga yuboriladi (xom rasm yuborilmaydi)
  ↓
Server: vektorlar shifrlangan holda face_embeddings jadvaliga saqlanadi
  ↓
Xodim profili: "Yuz ID: ✅ Ro'yxatdan o'tilgan"
```

### 4.2 Kunlik Kesh Yangilanishi

```
Har kecha 23:00 — Cron Job:
  → Har filial uchun faol xodimlar vektorlari + ish boshlanish vaqti to'planadi
  → Shifrlangan JSON paket tayyorlanadi
  → Planshet keyingi ulanishda GET /face/cache/:branchId dan yuklab oladi
  → Planshet IndexedDB ga saqlaydi
```

### 4.3 Kunlik Davomat (Planshet, Filial Kirishi)

```
Xodim planshetga yuzini ko'rsatadi
  ↓
face-api.js → IndexedDB keshdan barcha vektorlar bilan solishtiradi
  ↓
       ↙ Ishonch ≥ 80%          ↘ Ishonch < 80%
  Aniqlandi                    Server fallback:
       ↓                        Python face_recognition
       ↓                             ↓
       ↓               ↙ Aniqlandi   ↘ Aniqlanmadi
       ↓              ↓                    ↓
       ↓          Natija             Qo'lda login tugmasi
       ↓          qaytdi             + Filadminga notification
       ↓
  Ish vaqti tekshiriladi:
    Vaqt ≤ boshlanish vaqti → ✅ Keldi
    Vaqt > boshlanish vaqti → ⏰ Kech keldi (N daqiqa)
  ↓
  attendance_staff jadvaliga yoziladi
  Planshetda tasdiqlash animatsiyasi (2 soniya)
  ↓
  Ekran tozalanadi → keyingi xodim uchun tayyor
```

### 4.4 Holat Diagrammasi

```
Enrollment qilinmagan → Enrollment qilindi → [Kunlik kesh]
                                                    ↓
                                           Yuz ko'rsatildi
                                                ↙      ↘
                                         Aniqlandi   Aniqlanmadi
                                             ↓            ↓
                                         Davomat     Qo'lda login
                                         belgilandi  (log: manual)
```

---

## 5. MA'LUMOTLAR MODELI

```sql
face_embeddings (yuz vektorlari)
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  user_id          UUID NOT NULL REFERENCES users(id)
  embedding        VECTOR(128)            -- face-api.js 128-o'lchovli vektor
  enrolled_at      TIMESTAMPTZ DEFAULT NOW()
  enrolled_via     TEXT NOT NULL          -- 'mobile' | 'admin'
  is_active        BOOLEAN DEFAULT TRUE

face_recognition_log (har bir urinish logi)
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  branch_id        UUID NOT NULL
  device_id        TEXT NOT NULL          -- planshet identifikatori
  matched_user_id  UUID REFERENCES users(id)  -- null = aniqlanmadi
  confidence       FLOAT                  -- 0.0 – 1.0
  method           TEXT NOT NULL          -- 'local' | 'server'
  result           TEXT NOT NULL          -- 'matched' | 'fallback_manual' | 'failed'
  attempted_at     TIMESTAMPTZ DEFAULT NOW()

branch_devices (filial planshetlari)
  id               UUID PRIMARY KEY
  branch_id        UUID NOT NULL REFERENCES branches(id)
  device_name      TEXT NOT NULL          -- "Asosiy kirish", "Orqa kirish"
  device_token     TEXT UNIQUE NOT NULL   -- kiosk autentifikatsiya tokeni
  last_cache_sync  TIMESTAMPTZ
  is_active        BOOLEAN DEFAULT TRUE
  created_at       TIMESTAMPTZ DEFAULT NOW()
```

**Mavjud jadval yangilanadi:**
```sql
ALTER TABLE attendance_staff
  ADD COLUMN recognition_method TEXT DEFAULT 'manual',
    -- 'face_auto' | 'face_fallback' | 'manual' | 'admin'
  ADD COLUMN confidence         FLOAT,
  ADD COLUMN device_id          TEXT REFERENCES branch_devices(id);
```

**Mavjud branches jadvaliga qo'shimcha:**
```sql
ALTER TABLE branches
  ADD COLUMN work_start_time TIME DEFAULT '09:00',  -- ish boshlanish vaqti
  ADD COLUMN late_grace_minutes INT DEFAULT 5;       -- kechikish toleransi (daqiqa)
```

**Index:**
```sql
CREATE INDEX idx_face_embeddings_user ON face_embeddings(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_face_log_branch_date ON face_recognition_log(branch_id, attempted_at);
```

---

## 6. UI/UX

### 6.1 Planshet — Kiosk Ekrani (Doim Ochiq)

```
┌─────────────────────────────────────────────────┐
│           🏫 A'lochi — Xodimlar Kirishi         │
│                                                  │
│              [ KAMERA OYNASI ]                  │
│                                                  │
│         Yuzingizni ko'rsating...                │
│              ◉  ──────  ◉                       │
│                                                  │
│         ──────────────────────────              │
│              [🔑 Login bilan kirish]             │
└─────────────────────────────────────────────────┘
```

**Muvaffaqiyatli aniqlanganda (2 soniya ko'rsatiladi):**
```
┌─────────────────────────────────────────────────┐
│                                                  │
│              ✅  Xush kelibsiz!                 │
│           Nodira Karimova                        │
│        Kelish vaqti: 09:02                      │
│      ⏰ 2 daqiqa kech (ish 09:00 da)            │
│                                                  │
└─────────────────────────────────────────────────┘
```

**O'z vaqtida kelganda:**
```
┌─────────────────────────────────────────────────┐
│              ✅  Xush kelibsiz!                 │
│           Alisher Toshev                         │
│        Kelish vaqti: 08:55  •  ✅ O'z vaqtida  │
└─────────────────────────────────────────────────┘
```

### 6.2 Xodim Telefoni — Enrollment

```
Profil sahifasi:
┌─────────────────────────────────────────────────┐
│  👤 Mening Profilim                             │
│  ─────────────────────────────────────────────  │
│  Ism: Nodira Karimova  •  Rol: Filadmin         │
│                                                  │
│  Yuz ID:  ❌ Ro'yxatdan o'tilmagan             │
│  [📷 Yuzimni ro'yxatdan o'tkazish]             │
└─────────────────────────────────────────────────┘

Enrollment jarayoni:
┌─────────────────────────────────────────────────┐
│  📷 Yuz Ro'yxatga Olish  (5 ta rasm)           │
│                                                  │
│         [ KAMERA OYNASI ]                       │
│                                                  │
│  ● ● ● ● ●  ← Progress                        │
│  ✅ ✅ ⬜ ⬜ ⬜                               │
│                                                  │
│  👉 Endi chapga qarang...                      │
└─────────────────────────────────────────────────┘

Tugaganda:
┌─────────────────────────────────────────────────┐
│  ✅ Yuzingiz muvaffaqiyatli saqlandi!           │
│  Ertadan boshlab filial kirishida               │
│  avtomatik aniqlanasiz.                         │
└─────────────────────────────────────────────────┘
```

### 6.3 Filadmin Paneli — Yangilangan Davomat Jadvali

```
┌─────────────────────────────────────────────────┐
│ XODIMLAR DAVOMATI  •  24-aprel        [Eksport] │
├────────────────┬──────────┬──────────┬──────────┤
│ Xodim          │ Vaqt     │ Holat    │ Usul     │
├────────────────┼──────────┼──────────┼──────────┤
│ Nodira K.      │ 09:02    │ ⏰ Kech  │ 👁 Yuz  │
│ Alisher T.     │ 08:55    │ ✅ Keldi │ 👁 Yuz  │
│ Kamola N.      │ 09:30    │ ⏰ Kech  │ 🔑 Qo'lda│
│ Bobur Y.       │ —        │ ❌ Kelmadi│ —       │
└────────────────┴──────────┴──────────┴──────────┘

Usul belgilari:
  👁 Yuz — avtomatik aniqlangan
  🔑 Qo'lda — login/parol bilan kirgan
  👤 Admin — Filadmin qo'lda belgilagan
```

---

## 7. API ENDPOINTLAR

```
ENROLLMENT:
POST   /face/enroll                → 5 ta vektor yuborish, profil yangilanadi
DELETE /face/enroll                → Yuz ma'lumotini o'chirish
GET    /face/enroll/status         → Ro'yxatdan o'tilganmi?

KIOSK:
POST   /face/recognize             → Server fallback aniqlash
GET    /face/cache/:branchId       → Kunlik kesh (planshet yuklab oladi)
POST   /face/manual-checkin        → Qo'lda login (yuz aniqlanmasa)

QURILMA BOSHQARUVI (Filadmin/Superadmin):
POST   /devices                    → Yangi planshet ro'yxatga olish
GET    /devices/:branchId          → Filial planshetlari
PATCH  /devices/:id/deactivate     → Planshetni o'chirish
GET    /devices/:id/status         → Planshet holati + oxirgi kesh vaqti
```

---

## 8. CRON JOBS

| Vazifa | Jadval | Tavsif |
|--------|--------|--------|
| Kunlik kesh generatsiya | 23:00 | Har filial uchun faol xodimlar vektorlari paketlanadi |
| Eskirgan kesh ogohlantirish | 08:00 | 2+ kun kesh yangilanmagan planshetlarga Filadminga alert |
| Enrollment eslatma | Dushanba 09:00 | Enrollment qilmagan xodimlar — Filadminga haftalik ro'yxat |

---

## 9. XATO HOLATLARI

| Xato | Tizim reaksiyasi |
|------|-----------------|
| Yuz aniqlanmadi (3 urinish) | "Yuzingiz aniqlanmadi" + qo'lda login tugmasi + Filadminga notification |
| Xodim enrollment qilmagan | "Yuzingiz ro'yxatdan o'tilmagan, login bilan kiring" |
| Internet yo'q | Keshdan ishlaydi; log offline saqlanadi, internet kelganda sync |
| Kesh 2+ kun eskirgan | Planshetda sariq banner: "Kesh eskirgan — Filadmin bilan bog'laning" |
| Bir xodim 2 marta kirmoqchi | "Siz bugun allaqachon belgilangansiz (09:02)" — rad etiladi |
| Planshet token muddati o'tdi | Faqat qo'lda login ishlaydi; Filadmin admin paneldan qayta faollashtiradi |
| Server fallback ham aniqlamadi | Qo'lda login + log: `result: 'failed'` + Filadmin notification |
| Enrollment paytida yuz aniqlanmasa | "Yuzingizni to'g'ri yoritilgan joyda qayta urinib ko'ring" |

---

## 10. XAVFSIZLIK VA PDPL

| Talab | Yechim |
|-------|--------|
| Xom rasm saqlanmaydi | Faqat 128 o'lchovli vektor yuboriladi va saqlanadi |
| Vektor orqali asl yuz tiklanmaydi | face-api.js one-way embedding — matematik vektor |
| Ma'lumot O'zbekistonda saqlanadi | Server O'zbekistonda joylashgan (PDPL §533) |
| Xodim o'z ma'lumotini o'chira oladi | `DELETE /face/enroll` — har doim mavjud |
| Planshet token xavfsizligi | Device token JWT ga o'ralgan, 90 kunlik muddati bor |
| Kesh shifrlangan | AES-256 bilan shifrlangan JSON, faqat o'sha planshet ochishi mumkin |

---

## 11. MAVJUD TZ BILAN BOG'LIQLIK

Bu spec asosiy TZ `2026-04-23-alochi-platform-design.md` ning **Section 7.2** (Xodim Davomati) bo'limini kengaytiradi.

**Faza:** Faza 2 da qo'shish tavsiya etiladi — Faza 1 da qo'lda "Keldim" tizimi ishlaydi, Face ID keyinroq qo'shiladi.

**Yangi texnik komponentlar:**
- AI Service ga Python face_recognition moduli qo'shiladi
- pgvector PostgreSQL extension o'rnatiladi
- Branch devices boshqaruvi Filadmin paneliga qo'shiladi

---

*Face ID davomat tizimi — xodimlar kirishini tezlashtiradi va qo'lda belgilash yukini yo'q qiladi.*

---

## 12. APPARAT TALABLARI, SLA VA LIVENESS DETECTION

### 12.1 Minimal Android Planshet Talablari

| Komponent | Minimal talab | Tavsiya etilgan | Sabab |
|-----------|--------------|----------------|-------|
| RAM | 3 GB | 4 GB | face-api.js TensorFlow.js modeli ~300 MB RAM oladi; kiosk Chrome + PWA bilan birga |
| Protsessor | Quad-core 1.8 GHz | Octa-core 2.0 GHz+ | Yuz aniqlash < 1 soniyada bo'lishi uchun |
| Kamera (old) | 5 MP, 720p | 8 MP, 1080p | Yuz aniqlik sifatiga to'g'ridan-to'g'ri ta'sir qiladi |
| Saqlash | 32 GB | 64 GB | IndexedDB kesh + Chrome + PWA |
| Android versiyasi | Android 8.0 (Oreo) | Android 11+ | Chrome kiosk mode va WebRTC to'liq qo'llab-quvvatlashi uchun |
| Ekran | 7 inch, 1024×600 | 10 inch, 1920×1200 | Kiosk UI to'liq ko'rsatilishi uchun |

**Tavsiya etilgan model sinflar:** Samsung Galaxy Tab A, Lenovo Tab M10, Xiaomi Pad — minimal talabni qondiruvchi narx/sifat nisbatidagi qurilmalar.

### 12.2 Ishlash SLA (Service Level Agreement)

| Ko'rsatkich | Maqsad | Minimal qabul qilinadigan |
|------------|--------|--------------------------|
| Yuz tanish muvaffaqiyat darajasi | ≥ 95% (normal yoritilganlik, ro'yxatdan o'tilgan xodim) | 90% |
| Tanish vaqti (planshet) | < 1.5 soniya (P95) | < 3 soniya |
| Server fallback vaqti | < 3 soniya (P95) | < 5 soniya |
| Kiosk ekran javob berish | < 100ms tap latency | < 300ms |
| Kunlik kesh yuklanish vaqti | < 30 soniya (100 xodim uchun) | < 60 soniya |

**Normal yoritilganlik ta'rifi:** 300–1000 lux (ofis/sinf xonasi standart yoritilganligi). Aniqlash 200 lux dan past bo'lsa tizim "Yorug'lik yetarli emas" xabarini ko'rsatadi va qo'lda loginni taklif qiladi.

### 12.3 Liveness Detection (Anti-Spoofing)

Maqsad: Tajovuzkor boshqa xodimning rasmini kamerasiga tutib tizimni aldashini oldini olish.

**Strategiya: Passive Challenge (Minimal Frictional)**

```
Yuz aniqlanganda (confidence > 60%) →
  Liveness challenge ishga tushadi:
    Xodimga ko'rsatma: "Ko'zingizni yumib oching"
    Kutish: 2 soniya ichida ko'z pirpirashini aniqlash
      ↙ Ko'z pirpiradi            ↘ Pirpirash yo'q
   Liveness: ✅ PASS           Liveness: ❌ FAIL
   → Recognition davom etadi   → "Siz haqiqiy odammisiz?" + qayta urinish
                                → 3 marta fail → qo'lda login + log: 'spoof_attempt'
```

**Implementatsiya:**
- face-api.js EAR (Eye Aspect Ratio) — ko'z ochiq/yumiq holatini hisoblash
- EAR < 0.25 = ko'z yumilgan; ketma-ket ochiq→yumiq→ochiq = bir pirpiram
- Statik rasm yoki video loop EAR ni o'zgartirmaydi → fail

**Muhim nuance:** Liveness detection faqat `confidence ≥ 60%` bo'lganda ishga tushadi. Past confidence darhol server fallback ga o'tadi (liveness shu yerda ham tekshiriladi).

**`face_recognition_log` yangilanadi:**
```sql
ALTER TABLE face_recognition_log
  ADD COLUMN liveness_passed BOOLEAN DEFAULT NULL;
  -- NULL = liveness tekshirilmagan (past confidence → fallback)
  -- TRUE = liveness passed
  -- FALSE = liveness failed (spoof urinish logi)
```

---

## 13. QABUL MEZONLARI (UAT)

| Mezon | Muvaffaqiyat |
|-------|-------------|
| Enrollment | Xodim 5 ta rasm oldiradi, profilda "✅ Ro'yxatdan o'tilgan" ko'rinadi |
| Yuz aniqlash (normal) | Normal yoritilganlikda ≥ 95% muvaffaqiyatli taniladi |
| Keldi belgisi | Yuz aniqlangandan 3 soniya ichida davomat jadvalida ko'rinadi |
| Kech keldi | Ish boshlanish vaqtidan kech kelganda ⏰ belgisi + daqiqa ko'rsatiladi |
| Offline rejim | Internet uzilganda keshdan ishlaydi, log saqlanadi |
| Qo'lda login | 3 marta aniqlanmasa login shakli chiqadi + Filadminga notification |
| 2 marta kirish | Xodim 2 marta kirmoqchi bo'lsa "Allaqachon belgilangansiz" xabari |
| Kesh yangilanishi | Yangi xodim qo'shilsa ertasi kuni planshet yangi keshni oladi |
| Planshet kiosk | Faqat davomat ilovasi ko'rinadi, boshqa ilovalarga o'tib bo'lmaydi |
| Filadmin hisobot | Davomat jadvalida "👁 Yuz" va "🔑 Qo'lda" usullari ko'rsatiladi |
