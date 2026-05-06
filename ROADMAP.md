# A'lochi — Roadmap

> Loyiha 4 ta katta Faza'ga bo'lingan. Har Faza bir necha oy davom etadi
> va o'zining alohida mahsulot rejasini chiqaradi. Mukammal asos:
> [docs/superpowers/specs/2026-04-23-alochi-platform-design.md](docs/superpowers/specs/2026-04-23-alochi-platform-design.md).
>
> Quality bar: har Phase oxirida `tsc --noEmit`, `eslint`, `jest`, `nest build` va
> `next build` PASS bo'lishi shart. Yarim Faza'lar yo'q.

---

## Faza 1 — MVP (4 oy) ✅

**Maqsad:** Ishlaydigan asosiy platforma — AI va kamera holati hali yoqilmagan.

- Auth + RBAC (6 rol: superadmin, filadmin, manager, mentor, tester, o'quvchi)
- Superadmin: dars boshqaruvi (video + MCQ test + so'z tartibi)
- Filial / tenant boshqaruvi
- O'quvchi dars jarayoni: video ko'rish (tezlashtirish blok) + MCQ/so'z tartibi testlar
- Mentor paneli: status berish, davomat
- Manager paneli: qizil/sariq ro'yxat, N override
- Filadmin paneli: ogohlantirish, to'lov, xodim boshqaruvi
- Status tizimi (3 ta: ingliz / shaxsiy / tanqidiy) — qo'lda berish
- Davomat tizimi (o'quvchi + xodim)
- KPI tizimi (Mentor, Manager)
- Ogohlantirish tizimi + to'lov bloklash (cron job)
- Vazifa tizimi (task management)
- Delegatsiya audit ([2026-04-24-delegation-audit-design.md](docs/superpowers/specs/2026-04-24-delegation-audit-design.md))

> MVP da lug'at bo'limi matnli formatda ishlaydi (og'zaki emas).

**Holat:** ✅ Bajarildi.

---

## Faza 2 — AI va Muloqot (4 oy) ✅

**Maqsad:** AI komponentlar va ota-onalar bilan muloqot.

- Google Gemini AI Tutor (Q&A, dars bo'yicha tushuntirish)
- Azure Speech (talaffuz tekshirish — lug'at bo'limining og'zaki formati)
- MediaPipe kamera monitoring (akademiya topshirish)
- Google Gemini yakuniy baholash (akademiya topshirishda)
- Telegram bot (ota-onalar + xodimlar + o'quvchilar)
- Ilg'or gamifikatsiya:
  - Virtual shahar
  - XP, streak, daily quests, streak shield
- Sertifikat ekotizimi (QR kodli, PDF/PNG)
- Face ID avtomatik davomat (face-api.js + pgvector + Python fallback) —
  spec: [2026-04-24-face-id-attendance-design.md](docs/superpowers/specs/2026-04-24-face-id-attendance-design.md)

**Holat:** ✅ Bajarildi.

---

## Faza 3 — Intellektual va Ijtimoiy Tizim (3 oy) ✅

**Maqsad:** Adaptiv o'qitish, bashoratli tahlil, ijtimoiy funksiyalar.

- Adaptiv o'qitish (spaced repetition + qiyinlik moslashishi)
- Bashoratli tahlil:
  - Churn prediction (yetarli data to'plangach)
  - Risk xarita
- Kontent sifat nazorati:
  - A/B test
  - Alertlar
  - Feedback
- Ijtimoiy funksiyalar — spec: [2026-04-24-social-features-design.md](docs/superpowers/specs/2026-04-24-social-features-design.md)
  - Do'stlar
  - Duel 1v1
  - Guruh challenge (7 kunlik)
  - Guruh chat
  - Moderatsiya
- Turnirlar va milliy olimpiada
- ClickHouse analytics

**Holat:** ✅ Bajarildi.

---

## Faza 4 — Scale va SaaS (2 oy) ✅

**Maqsad:** Ko'p markaz onboarding, mobil optimizatsiya, ML stabilizatsiya.

- Multi-tenant onboarding (yangi markazlar uchun) —
  spec: [2026-04-30-faza4-tenant-onboarding-design.md](docs/superpowers/specs/2026-04-30-faza4-tenant-onboarding-design.md)
- ClickHouse analytics to'liq —
  spec: [2026-04-30-faza4-clickhouse-analytics-design.md](docs/superpowers/specs/2026-04-30-faza4-clickhouse-analytics-design.md)
- Mobil optimizatsiya (PWA) —
  spec: [2026-04-30-faza4-pwa-design.md](docs/superpowers/specs/2026-04-30-faza4-pwa-design.md)
- ML modelni avtomatik yangilash —
  spec: [2026-04-30-faza4-ml-churn-design.md](docs/superpowers/specs/2026-04-30-faza4-ml-churn-design.md)
- AI Lesson Generator (Phase 14) —
  spec: [2026-05-05-ai-lesson-generator-design.md](docs/superpowers/specs/2026-05-05-ai-lesson-generator-design.md)
- Performance: DB indexes (`EXPLAIN ANALYZE` asosida)
- Tenant branding (logo, rang, brand nomi)

**Holat:** ✅ Bajarildi.

---

## Faza 5+ — Kelajak

> Aniq belgilangan emas — strategik fursatlar yuzaga chiqqanda qaror qilinadi.
> "Hozir nima qilamiz?" emas, "ehtiyojni qachon ko'rsak, qanday harakat
> qilamiz?" sifatida o'qiladi.

### Mumkin yo'nalishlar

- **Real markaz pilot** — 1-3 markazda 3 oylik chuqur sinov.
- **Case study to'plash** — pitch deck'dagi placeholder'larni real
  raqamlar bilan to'ldirish.
- **Sotuv jarayoni avtomatlash** — landing → demo so'rovi → onboarding flow.
- **Yangi vertical** — Matematika yoki Ona tili (mavzuga moslab dars
  generatsiyasi).
- **Mobil ilova (Native iOS/Android)** — PWA dan tashqari, agar markaz
  egalari talab qilsa.

### Kechiktirildi (qaytarildi)

> 2026-05-06 da loyiha "dunyo darajasi" yo'lidan A'lochi MVP'ga qaytarildi.
> Quyidagi fazalar archive'ga ko'chirildi:
> [docs/superpowers/.archive/global-push/](docs/superpowers/.archive/global-push/)
>
> - i18n (uz/en/ru) → faqat o'zbekcha
> - Stripe to'lov → manual to'lov tracking
> - 2FA TOTP → klassik parol + JWT
> - Multi-country (Tojikiston/Qozog'iston/Qirg'iziston) → faqat O'zbekiston
>
> Agar bu yo'nalishlar kelajakda qayta kerak bo'lsa, archive'dagi specdan
> boshlanadi.

---

## Vaqt jadvali (jami ~13 oy)

```
Faza 1 — MVP (4 oy)
├── Oy 1: Auth, Rollar (RBAC), DB, Superadmin panel
├── Oy 2: O'quvchi dars jarayoni, Mentor/Manager paneli
├── Oy 3: Status, Davomat, KPI, Vazifa, Ogohlantirish, To'lov, Delegatsiya
└── Oy 4: Beta test, xato tuzatish, performance optimallashtirish

Faza 2 — AI, Muloqot va Face ID (4 oy)
├── Oy 5: Gemini AI Tutor + Azure talaffuz
├── Oy 6: MediaPipe + yakuniy baholash + Telegram bot
├── Oy 7: Gamifikatsiya, Sertifikat (QR)
└── Oy 8: Face ID avtomatik davomat (face-api.js + pgvector + Python fallback)

Faza 3 — Intellektual va Ijtimoiy Tizim (3 oy)
├── Oy 9:  Adaptiv o'qitish, Kontent sifat nazorati (A/B)
├── Oy 10: Ijtimoiy funksiyalar — do'st, duel, challenge, chat, moderatsiya
└── Oy 11: Churn, turnirlar, ClickHouse analytics

Faza 4 — Scale va SaaS (2 oy)
├── Oy 12: Multi-tenant onboarding, PWA, AI Lesson Generator
└── Oy 13: Load testing, security audit, production launch
```

**Production launch:** 2027-yil II chorak (rejalashtirilgan).

---

> Hujjat tirik. O'zgartirish kerak bo'lsa — sabab bilan, [PITCH_DECK_INVESTOR.md](PITCH_DECK_INVESTOR.md)
> dagi "Qarorlar tarixi" bo'limiga yozib qoldiring.
