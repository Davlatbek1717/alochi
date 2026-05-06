# A'lochi — To'liq Foydalanish Qo'llanmasi

Ushbu qo'llanma loyihani noldan o'rnatish va har bir rolda kunlik
foydalanishni qamrab oladi.

---

## QISM 1 — Texnik O'rnatish

### 1.1 Talablar

| Dastur | Versiya | Tekshirish |
|---|---|---|
| **Node.js** | 20 LTS+ | `node -v` |
| **pnpm** | 9.x | `pnpm -v` |
| **PostgreSQL** | 14+ | `psql --version` |
| **Git** | istalgan | `git --version` |

pnpm o'rnatilmagan bo'lsa:
```bash
npm install -g pnpm
```

---

### 1.2 Loyihani yuklab olish

```bash
git clone <repo-url> alochi
cd alochi
pnpm install
```

---

### 1.3 Environment sozlash

```bash
# Ikkita joyga nusxa olish kerak
cp .env.example .env
cp .env.example apps/api/.env
```

Keyin `apps/api/.env` faylini ochib quyidagilarni to'ldiring:

```env
# Ma'lumotlar bazasi
DATABASE_URL=postgresql://postgres:SIZNING_PAROL@localhost:5432/alochi

# JWT kalitlar (openssl rand -base64 64 bilan yangi kalit oling)
JWT_SECRET=kamida-32-belgili-xavfsiz-kalit
JWT_REFRESH_SECRET=boshqa-kamida-32-belgili-xavfsiz-kalit

# Google Gemini AI (bepul: https://aistudio.google.com/apikey)
GEMINI_API_KEY=AIza...

# Telegram Bot (ixtiyoriy, ota-ona hisobotlari uchun)
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_WEBHOOK_URL=

# Portlar
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

### 1.4 Ma'lumotlar bazasini yaratish

```bash
# PostgreSQL'ga kiring va DB yarating
psql -U postgres -c "CREATE DATABASE alochi;"

# Barcha migratsiyalarni ishga tushiring
pnpm --filter api exec prisma migrate deploy

# Demo ma'lumotlar bilan to'ldirish (ixtiyoriy)
pnpm --filter api exec ts-node prisma/seed-demo.ts
```

> **Demo seed nima beradi:**
> - 1 ta superadmin (`superadmin` / `superadmin123`)
> - 1 ta demo markaz tenant
> - Demo xodimlar va o'quvchilar
> - 10 ta tayyor dars
> - Landing CMS namunalari (mukofotlar, homiylari)

---

### 1.5 Serverni ishga tushirish

**2 ta terminal ochish kerak:**

```bash
# Terminal 1 — API server (port 3001)
pnpm run dev:api

# Terminal 2 — Web server (port 3000)
pnpm run dev:web
```

Ikkala server tayyor bo'lganda:
- 🌐 **Web**: http://localhost:3000
- 🔌 **API**: http://localhost:3001
- 📖 **Swagger**: http://localhost:3001/api/docs

---

## QISM 2 — Birinchi Sozlash (Superadmin)

### 2.1 Kirish

http://localhost:3000/login → **superadmin / superadmin123**

---

### 2.2 Yangi markaz (Tenant) yaratish

1. **Superadmin paneli** → `Tenantlar` bo'limi
2. `+ Yangi markaz` tugmasi
3. Quyidagilarni kiriting:
   - Markaz nomi: `ABC English Center`
   - Slug (URL): `abc-english`
   - Shahar: `Toshkent`
4. Saqlang → Tenant ID avtomatik yaratiladi

---

### 2.3 Xodimlarni qo'shish

**Superadmin paneli** → `Foydalanuvchilar` → `+ Yangi`

Her bir markaz uchun kamida quyidagilarni yarating:

| Rol | Nomi | Login | Parol | Vazifa |
|---|---|---|---|---|
| **filadmin** | Sarvinoz Yusupova | sarvinoz | *** | Markaz direktori |
| **manager** | Bobur Rashidov | bobur | *** | O'quvchilar nazorati |
| **mentor** | Nilufar Karimova | nilufar | *** | Dars o'qitish |
| **tester** | Temur Aliyev | temur | *** | Imtihon nazorati |

---

### 2.4 Darslar yaratish

**Superadmin paneli** → `Darslar` → `+ Yangi dars`

Har bir dars uchun:
1. **Sarlavha**: `Lesson 1 — Greetings`
2. **Tartib raqami**: 1, 2, 3 ... (o'quvchi shu tartibda boradi)
3. **Kontekst**: dars mavzusini tushuntiruvchi matn (AI shu matn asosida suhbat qiladi)
4. **Komponentlar** qo'shish:
   - `mcq` — test savollari (imtihon uchun kerak, **kamida 10 ta savol** bo'lsin)
   - `vocabulary` — so'z lug'ati
   - `speak_sentence` — talaffuz mashqi
   - `flash_card` — kartochkalar
5. **Nashr qilish** tugmasi → o'quvchilarga ko'rinadi

---

### 2.5 O'quvchilarni qo'shish

**Superadmin paneli** → `Foydalanuvchilar` → `+ Yangi` → Rol: **student**

Yoki **Filadmin paneli** orqali ham qo'shsa bo'ladi.

Har bir o'quvchi uchun:
- Ism-familiya
- Login (telefon raqam yoki istalgan)
- Parol
- Filial (qaysi filialda o'qiydi)
- Guruh (ixtiyoriy)
- Viloyat, Maktab (landing page uchun)

---

### 2.6 Guruhlar yaratish

**Filadmin paneli** → `Filiallar` → Filial tanlash → `Guruhlar` → `+ Yangi guruh`

Guruhga o'quvchilar va mentor biriktiriladi.

---

### 2.7 Landing CMS sozlash

**Superadmin paneli** → `Landing CMS`

Bu yerda public saytnining barcha matnlari tahrirlanadi:
- **Hero** — asosiy sarlavha, tavsif, CTA tugmasi matni
- **Aloqa** — telefon, email, manzil, Telegram
- **Sertifikat** — sertifikat bo'limi matni
- **Mukofotlar** — yangi mukofot qo'shish, tahrirlash, o'chirish
- **Sayohat homiylari** — homiy kartochkalari

---

## QISM 3 — Kunlik Foydalanish (Har bir Rol)

---

### 👤 STUDENT — O'quvchi

**Login**: http://localhost:3000/login

#### Asosiy ekranlar:

**1. Dashboard** (`/student`)
- Bugungi dars holati (yashil/sariq/qizil)
- Streak (ketma-ket kunlar)
- Keyingi darsga o'tish tugmasi
- Yangi xabarlar va ogohlantirish

**2. Yo'l xaritasi** (`/student/lessons`)
- 250 ta darsning zigzag ko'rinishi
- Har bir dars: ✅ bajarilgan / 🔵 joriy / 🔒 qulflangan
- Sidebar: progress, streak, bugungi faollik

**3. Dars boshlash**
- Sariq aylana = joriy dars → bosing
- Pastdan "Boshlash" tugmasi
- Komponentlar ketma-ket chiqadi: so'zlar, savol-javob, talaffuz
- AI suhbat: savol bersangiz javob beradi
- Kamera ishga tushadi (akademiya topshirig'ida)
- Tugatgandan keyin → **sertifikat** + **ota-onaga Telegram**

**4. Imtihon**
- Mentor imtihon ruxsati berganidan keyin aktiv bo'ladi
- 10 ta savol → natija avtomatik saqlanadi

**5. Profil** (`/student/profile`)
- Ota-ona Telegram ID ulash
- Tug'ilgan sana kiritish
- Ovoz va mikrofon sozlamalari

---

### 👨‍🏫 MENTOR

**Login**: http://localhost:3000/login → `/mentor`

#### Asosiy vazifalar:

**1. Guruh ko'rish** (`/mentor/group`)
- Guruhidagi barcha o'quvchilar ro'yxati
- Har birining holati: yashil 🟢 / sariq 🟡 / qizil 🔴
- Xato ko'p qilayotgan o'quvchilar → `AI xato tahlili` tugmasi
- O'quvchiga shaxsiy dars ochish imkoni

**2. Status qo'yish**
- O'quvchi kartasidagi rangli tugma
- `Shaxsiy rivojlanish` uchun yashil/sariq/qizil tanlash
- Yashil qo'yilsa → **tanqidiy fikrlash holati ham avtomatik yashilga o'tadi** ✅
- Izoh qo'shish ixtiyoriy

**3. Imtihon ruxsati berish**
- O'quvchi ekranida `Imtihon` tugmasi
- Kerakli darsni tanlash → ruxsat yaratish
- O'quvchi endi imtihonni boshlayoladi

**4. Davomat**
- Kunlik davomat belgilash
- Face ID orqali avtomatik ham bo'ladi (agar yuz ro'yxatdan o'tgan bo'lsa)

---

### 📊 MANAGER

**Login**: http://localhost:3000/login → `/manager`

#### Asosiy vazifalar:

**1. Qizil/sariq o'quvchilar**
- Bosh sahifada: 🔴 Qizil ro'yxat, 🟡 Sariq ro'yxat
- Har biri uchun: **1:1 sessiya** jadval qilish
- Sessiya natijasini kiritish

**2. Holat o'zgartirish**
- Qizil → sariq = **+10 KPI ball**
- Sariq → yashil = **+15 KPI ball**
- KPI dashboard'da ko'rinadi

**3. KPI monitoring**
- O'zining va mentorlarning KPI ko'rsatkichlari
- Oylik hisobotlar

**4. Mukofotlar tarqatish**
- O'quvchilarga yutuqlar berish
- Mukofot turlari: Mini Prize (50 qadam), Silver, Gold

---

### 🏢 FILADMIN

**Login**: http://localhost:3000/login → `/filadmin`

#### Asosiy vazifalar:

**1. To'lovlar** (`/filadmin/payments`)
- Filial bo'yicha oylik to'lovlar
- To'lov qilinmagan o'quvchilar ro'yxati
- Bloklash / razbloklovka

**2. Xodimlar boshqaruvi**
- Mentor, manager, tester qo'shish
- Ish vaqtini ko'rish
- KPI natijalariga qarab mukofotlash

**3. Filiallar** (`/filadmin/branches`)
- Yangi filial qo'shish
- Filial statistikasini ko'rish

**4. Ogohlantirishlar**
- O'quvchilarga ogohlantirish yuborish
- 3 ta ogohlantirish → avtomatik blok

**5. Analytics**
- Filial bo'yicha umumiy ko'rsatkichlar
- Davomat, progress, churn risk

---

### 🧪 TESTER

**Login**: http://localhost:3000/login → `/tester`

#### Asosiy vazifalar:

**1. Imtihon navbati** (`/tester/exam-queue`)
- Imtihon kutayotgan o'quvchilar
- Boshlash → nazorat qilish → yakunlash

**2. Texnik muammolar**
- O'quvchi texnik muammo bildirsa — ko'rish va hal qilish
- Holat: yangi / ko'rildi / hal qilindi

**3. Davomat**
- Imtihon seansi davomatini belgilash

---

### 👨‍👩‍👧 OTA-ONA (Telegram orqali)

To'g'ridan-to'g'ri o'rnatma kerak emas — Telegram bot orqali ishlaydi.

1. O'quvchining profil sahifasida **Telegram ulash havolasi** bor
2. Ota-ona havolani bosib bot bilan ulanadi
3. Har kuni avtomatik hisobot keladi:
   - Bugungi darslar: ✅ / ❌
   - Holat: yashil/sariq/qizil
   - Davomat
4. Tizim bildirishnomalar yuboradi:
   - Bola darsni tugatganda
   - Bola bloklandanda
   - Ogohlantirish kelganda
   - Sertifikat olganda

---

## QISM 4 — Qo'shimcha Imkoniyatlar

### 4.1 Sertifikatlar

O'quvchi har 50 ta dars tugatganda sertifikat oladi:
- QR-kod bilan rasmiylashtirilgan
- Ota-onaga Telegram orqali yuboriladi
- Student profil sahifasida saqlanadi

### 4.2 Duel (O'quvchilar o'rtasida)

- Ikki o'quvchi **bir xil darsni** tugatgan bo'lishi kerak
- O'sha darsdan **kamida 10 ta savol** bo'lishi kerak
- O'quvchi boshqa o'quvchiga `Duel chaqirish` tugmasini bosadi
- 10 savol — kim tezroq to'g'ri javob bersa g'alaba
- 24 soat muddati

### 4.3 Harflar kolleksiyasi

- Har dars tugatganda tasodifiy harf ochiladi
- 36 ta harf to'liq yig'ilganda — maxsus mukofot
- Student profil sahifasida ko'rinadi

### 4.4 Taqvim / Spaced Repetition

- AI eski so'zlarni qayta esga soladi
- Har kuni "Bugungi takrorlash" ro'yxati chiqadi
- Ebbinghaus krivi asosida ishlaydi

### 4.5 Face ID (Yuz ro'yxatdan o'tish)

O'quvchi (`/profile/enroll`):
1. "Yuz ro'yxatdan o'tish" tugmasini bosadi
2. Kamera orqali 5 ta rasm oladi
3. Keyingi akademiya topshiriqlarida avtomatik davomat

### 4.6 AI Oral Imtihon (Brauzer yo'li)

- Mentor ruxsat beradi → Student imtihonni boshlaydi
- Ovozli savol-javob: AI savollarni aytadi, student ovoz bilan javob beradi
- Natija avtomatik hisoblanadi

---

## QISM 5 — Tez-tez Uchraydigan Muammolar

| Muammo | Sababi | Yechim |
|---|---|---|
| AI chat 503 | GEMINI_API_KEY noto'g'ri | `apps/api/.env` → yangi kalit kiriting |
| Kirish ishlamayapti | Server yoqilmagan | `pnpm run dev:api` ishga tushiring |
| Duel yaratib bo'lmaydi | Umumiy dars yo'q | Ikki o'quvchi bitta darsni tugatsın |
| Duel savol yetmaydi | Darsda < 10 MCQ | Darsga ko'proq savol qo'shing |
| Telegram hisobot kelmayapti | Bot token yo'q | `.env` da `TELEGRAM_BOT_TOKEN` kiriting |
| Face ID ishlamayapti | HTTPS kerak | Production'da HTTPS ulang |
| O'quvchi kirg'andа qora ekran | `.next` cache | `rm -rf apps/web/.next` va qayta run |

---

## QISM 6 — Loyiha Arxitekturasi (Qisqacha)

```
alochi/
├── apps/
│   ├── api/               # Backend (NestJS + Prisma + PostgreSQL)
│   │   └── src/
│   │       ├── auth/       # Login, JWT, refresh
│   │       ├── users/      # Foydalanuvchilar CRUD
│   │       ├── lessons/    # Darslar
│   │       ├── exams/      # Imtihonlar
│   │       ├── ai/         # Gemini, Azure Speech
│   │       ├── marketing/  # Public landing API
│   │       └── ...
│   └── web/               # Frontend (Next.js 15 + Tailwind)
│       └── app/
│           ├── (marketing)/  # Public landing (alochi.uz)
│           ├── (dashboard)/  # Barcha rollar paneli
│           └── login/        # Kirish sahifasi
└── prisma/
    ├── schema.prisma      # Ma'lumotlar bazasi sxemasi
    ├── migrations/        # DB o'zgarishlari tarixi
    └── seed-demo.ts       # Demo ma'lumotlar
```

### Texnologiyalar:
- **Backend**: NestJS, Prisma ORM, PostgreSQL, Pino logger
- **Frontend**: Next.js 15, React 18, Tailwind CSS, PWA
- **AI**: Google Gemini Flash, Azure Speech Services
- **Bot**: Telegram (grammY library)
- **Auth**: JWT (1 soat) + Refresh Token (7 kun)

---

## QISM 7 — Muhim Buyruqlar Jadvali

```bash
# Loyihani ishga tushirish
pnpm run dev:api        # API: http://localhost:3001
pnpm run dev:web        # Web: http://localhost:3000

# Ma'lumotlar bazasi
pnpm --filter api exec prisma migrate dev    # Yangi migration yaratish
pnpm --filter api exec prisma migrate deploy # Migratsiya ishlatish
pnpm --filter api exec prisma studio         # DB vizual ko'rish

# Testlar
pnpm --filter api test                       # Barcha testlar
pnpm --filter api exec tsc --noEmit          # TypeScript tekshirish

# Build (production uchun)
pnpm run build                               # API + Web build

# Demo ma'lumotlar
pnpm --filter api exec ts-node prisma/seed-demo.ts
```

---

## Yordam

📞 +998 88 081 81 88
✈ t.me/Javohir_UH
✉ javohir.uh@gmail.com
