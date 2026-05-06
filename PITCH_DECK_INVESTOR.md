# A'LOCHI — Internal Team Document

> **Ichki hujjat** — jamoa uchun. Vision, texnik arxitektura, roadmap va
> risklar. VC pitch emas — agar kelajakda investor qidirilsa, alohida
> dokument yaratiladi.
>
> Maqsadi: yangi qo'shilgan jamoa a'zosi 30 daqiqada loyihani to'liq
> tushunsin. Strategik qarorlar uchun yagona haqiqat manbasi (single
> source of truth).

---

## 1. Vision

**A'lochi** — O'zbekistondagi ingliz tili o'quv markazlari uchun
operatsion SaaS tizim. 3–7 sinf o'quvchilarini AI orqali o'qitadi,
mentor/manager/filadminlarga real-vaqt panel beradi, ota-onaga
Telegram'da kunlik xabar yuboradi.

### Brending mantiqi

"A'lochi" o'zbek tilida — eng yaxshi o'quvchi. Brend va product hammasi
shu so'z atrofida quriladi: **bola kim bo'lib o'sishni xohlaydi, biz
shunga olib boramiz**.

### Hozirgi qamrov (MVP)

- **Hudud:** O'zbekiston (faqat). Multi-country yo'q.
- **Til:** O'zbekcha (faqat). Boshqa tillar yo'q.
- **Yosh:** 3-7 sinf (8-13 yosh).
- **Fan:** Ingliz tili (faqat). Matematika/Ona tili — keyin (Faza 4+ keyin).
- **Mijoz turi:** O'quv markaz egalari (B2B). Ota-ona/o'quvchi to'g'ridan-to'g'ri
  emas (B2B2C model).

### Nima uchun bunchalik tor?

Avvalgi versiya "Markaziy Osiyo + ko'p til + ko'p fan" deb keng yo'lga
chiqdi. Tor MVP'ga qaytdik chunki:

1. **Bitta segmentda chuqur** > ko'p segmentda yuza.
2. **Mahalliy realiyani** (Telegram, PDPL, naqd to'lov, tanish-bilish
   sotuvi) chuqur bilamiz — chet davlat = noaniqlik.
3. **Dars kontenti** har til/fan uchun alohida ishlanadi — ko'paytirish
   resurs yeydi. Avval bitta product to'g'ri bo'lsin.

---

## 2. Texnik Arxitektura

### Stack

| Qatlam | Texnologiya | Sabab |
|---|---|---|
| **Frontend (web)** | Next.js 15 (App Router) + React 18 + Tailwind | SEO landing + dashboard bir codebase'da. PWA fallback offline. |
| **Backend (API)** | NestJS 10 + Prisma 5 | RBAC + DI + tenant isolation oson. |
| **DB (asosiy)** | PostgreSQL 14+ | Tranzaktsional. Prisma migration. pgvector (Face ID). |
| **DB (analytics)** | ClickHouse | Million+ event uchun aggregatsiya. |
| **Cache** | Redis | Session, rate limit, hot data. |
| **AI Tutor** | Google Gemini 2.5 Flash | Narx/sifat balansi. Uzbek til yaxshi. |
| **Speech** | Azure Speech | Talaffuz baholash. |
| **Face ID** | MediaPipe (frontend) + face-api.js | 128-dim vector — surat saqlanmaydi. |
| **Bot** | Telegram (grammY) | Ota-ona kanali — O'zbekistonda Telegram = standart. |
| **Auth** | JWT + bcrypt + refresh token rotation | Klassik. Stateless. |
| **Multi-tenant** | Tenant ID stunlari + RBAC guard | Har tenant izolyatsiya. |

### Rollar (RBAC)

6 rol, har birining alohida UI va ruxsatlar to'plami:

1. **Superadmin** — platforma egasi (ya'ni Javohir). Tenantlar, darslar, ML.
2. **Filadmin** — markaz direktori. Xodim, to'lov, ogohlantirish.
3. **Manager** — qizil/sariq o'quvchilarga e'tibor. KPI bo'yicha mukofotlanadi.
4. **Mentor** — guruh bilan kunlik aloqa. Status berish, AI xato tahlili.
5. **Tester** — imtihon nazorati va texnik yordam.
6. **O'quvchi** — yo'l xaritasi, AI suhbat, do'stlar bilan duel.

### Asosiy domen modellari

- `Tenant` (markaz) → `Branch` (filial) → `Group` (guruh) → `User` (o'quvchi/xodim)
- `Lesson` → `LessonComponent` (video/MCQ/word-order/pronunciation)
- `StudentProgress` (har dars uchun)
- `Status` (yashil/sariq/qizil — 3 vertikal: ingliz/shaxsiy/tanqidiy)
- `Attendance` (o'quvchi va xodim)
- `Warning` (3 ta = blok)
- `TenantSubscription` (manual to'lov tracking)

### Quality bar

Har PR oldidan o'tishi shart:
- `tsc --noEmit` (api + web)
- `eslint` (api + web)
- `jest` (api unit + integration)
- `nest build` + `next build`

PR fayl o'zgartirgan bo'lsa — gate ishlamasa merge yo'q.

---

## 3. Roadmap (Faza 1-4)

> Bu — original A'lochi spec ([2026-04-23-alochi-platform-design.md](docs/superpowers/specs/2026-04-23-alochi-platform-design.md)) bo'yicha.
> Global push fazalari (i18n, Stripe, 2FA, multi-country) archive'ga
> ko'chirildi: [docs/superpowers/.archive/global-push/](docs/superpowers/.archive/global-push/).

### Faza 1 — MVP (4 oy)

Asosiy platforma. AI va kamera holati hali yoqilmagan.

- Auth + RBAC (6 rol)
- Superadmin: dars boshqaruvi (video + MCQ + word-order)
- O'quvchi dars jarayoni (video + test)
- Mentor/Manager/Filadmin/Tester panellari
- Status (yashil/sariq/qizil — qo'lda)
- Davomat (o'quvchi + xodim)
- KPI tizimi
- Ogohlantirish + to'lov bloklash (cron)
- Vazifa tizimi
- Delegatsiya audit (vakolatlar vaqtinchalik berish)

**Status:** ✅ Bajarildi.

### Faza 2 — AI va muloqot (4 oy)

- AI Tutor (Google Gemini Q&A)
- Azure Speech (talaffuz baholash)
- MediaPipe kamera nazorati
- Telegram bot (ota-ona + xodim + o'quvchi)
- Gamifikatsiya (XP, streak, virtual shahar, daily quests)
- Sertifikat ekotizimi (QR kodli PDF/PNG)
- Face ID avtomatik davomat (face-api.js + pgvector)

**Status:** ✅ Bajarildi.

### Faza 3 — Intellektual va ijtimoiy tizim (3 oy)

- Adaptiv o'qitish (spaced repetition + qiyinlik moslashishi)
- Bashoratli tahlil (churn prediction)
- Kontent sifat nazorati (A/B test, alertlar)
- Ijtimoiy funksiyalar (do'stlar, duel 1v1, guruh challenge, chat)
- Turnirlar va milliy olimpiada
- ClickHouse analytics

**Status:** ✅ Bajarildi.

### Faza 4 — Scale va SaaS (2 oy)

- Multi-tenant onboarding (yangi markazlar uchun)
- PWA (offline rejim)
- AI Lesson Generator (Phase 14 — filadmin mavzu kiritadi, AI dars yaratadi)
- ML model yangilash avtomatlashtirish
- Tenant onboarding flow

**Status:** ✅ Bajarildi.

### Faza 5+ — Kelajak

> Bu yerda **siz** yangi ehtiyojni topib qarorga kelasiz. Bo'sh ro'yxat
> emas — strategik fursatlar:

- **Real markaz pilot** — 1-3 markazda 3 oylik chuqur sinov.
- **Case study to'plash** — pitch deck'dagi placeholder'larni real
  raqam bilan to'ldirish.
- **Sotuv jarayoni avtomatlash** — landing → demo → onboarding flow.
- **Yangi vertical** — Matematika yoki Ona tili (mavzu/dars
  generatsiyasi A'lochi infrastrukturasidan foyda olishi mumkin).

---

## 4. Risklar

### Texnik

| Risk | Ehtimol | Ta'siri | Mitigation |
|---|---|---|---|
| AI provayder narx oshishi (Gemini) | O'rta | O'rta | Anthropic Claude / OpenAI fallback. Token cache. |
| ClickHouse muvaffaqiyatsizligi | Past | Yuqori | Daily backup. PostgreSQL'da kritik metriklar dublikat. |
| Face ID ishlamasligi (kameraning) | O'rta | Past | Fallback: qo'lda davomat. |
| PDPL talab o'zgarishi | O'rta | Yuqori | Yuz vektor — invertible emas. Encrypted at rest. Auditga tayyor. |

### Biznes

| Risk | Ehtimol | Ta'siri | Mitigation |
|---|---|---|---|
| Markaz egasi tushunmaydi | Yuqori | Yuqori | 14-kun bepul demo. Onboarding ga jonli yordam. |
| Yangi raqobatchi paydo bo'lishi | O'rta | O'rta | Mahalliy moslashish (Telegram, PDPL, til). Switching cost. |
| Maktab o'qituvchilari sotib olishni to'sadi | O'rta | O'rta | Markazlar bilan to'g'ridan-to'g'ri ishlash, maktab emas. |
| Trial → conversion past | Yuqori | Yuqori | Onboarding sifatini doimiy o'lchash. KPI: 14-kun trial → to'lov. |

### Asoschi

| Risk | Mitigation |
|---|---|
| Single point of failure (Javohir) | Kritik bilim docslarda. CLAUDE.md, spec/plan/.archive/. |
| Buyurtma overload | Quality bar — phase commit'lar. CI/CD avtomatlashtirilgan. |
| Burnout | YAGNI prinsipi. Phase 5+ aniq belgilanmagan — kerak bo'lganda qaror. |

---

## 5. Jamoa va resurslar

### Hozirgi jamoa

- **Javohir Uchqun ugli** — asoschisi va yagona muhandis.
  - 6+ yil software development.
  - Buxoro, O'zbekiston.
  - Aloqa: t.me/Javohir_UH · javohir.uh@gmail.com

### Texnologik infratuzilma

- Production: bulutda (provider tanlanadi — Hetzner / DigitalOcean / Yandex Cloud).
- Domain: alochi.com (planning) + tenant subdomainlar (`abc.alochi.com`).
- Kod: GitHub (private repo).
- Issue tracking: GitHub Issues.
- Secrets: `.env.example` shablon, prod secretlar Vault/SSM.

---

## 6. Qarorlar tarixi

> Strategik qarorlar bu yerda yoziladi — yangi a'zoga "nega bunaqa qilingan?"
> savoliga to'g'ridan-to'g'ri javob.

### 2026-05-06 — "Dunyo darajasi" g'oyasini qaytarish

**Holat:** Loyiha "Adouptivo / multi-country / multi-language / Stripe / 2FA"
yo'liga kirgan edi. Yarmidan to'xtatdik.

**Sabab:** Kuchli MVP > yarim-tugallangan global. Mahalliy bozorni chuqur
bilamiz, chet bozorni esa noaniqlik. Resource (vaqt, e'tibor) cheklangan.

**Qaror:** Hammasi A'lochi MVP'ga qaytarildi. Bu 7 ta phase'lik
revert: 2FA, Stripe, i18n, brand rename, archive. Reja:
[docs/superpowers/plans/2026-05-06-revert-to-alochi-mvp.md](docs/superpowers/plans/2026-05-06-revert-to-alochi-mvp.md).

**Ta'sir:** ~250 fayl o'zgardi, 3 schema migration rollback (0049, 0050, 0051),
3 dependency olib tashlandi (`next-intl`, `stripe`, `otplib`). Test/build
gates 411 PASS.

**Saqlandi:** AI Tutor, Azure Speech, MediaPipe, Telegram bot, gamification,
Face ID, social, adaptive, churn prediction, ClickHouse, PWA, AI Lesson
Generator (Phase 14), tenant onboarding, manual to'lov, performance indexes
(0047).

### Kelajak qarorlar

> Bu yerga davom ettirib turing.

---

## 7. Aloqa va resurslar

- **Asosiy spec:** [2026-04-23-alochi-platform-design.md](docs/superpowers/specs/2026-04-23-alochi-platform-design.md)
- **README:** [README.md](README.md)
- **Deployment:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **User guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **Roadmap:** [ROADMAP.md](ROADMAP.md)
- **Customer pitch:** [PITCH_DECK.md](PITCH_DECK.md)
- **Specs/plans:** [docs/superpowers/specs/](docs/superpowers/specs/) · [docs/superpowers/plans/](docs/superpowers/plans/)
- **Archived (global push):** [docs/superpowers/.archive/global-push/](docs/superpowers/.archive/global-push/)

---

> *Hujjat tirik. O'zgarishlar aniq sababsiz qabul qilinmaydi —
> "Qarorlar tarixi" bo'limiga yozib qoldiring.*
