# A'lochi — Delegatsiya Audit Tizimi

**Sana:** 2026-04-24
**Versiya:** 1.0
**Loyiha:** A'lochi Platform
**Holat:** Ko'rib chiqilmoqda

---

## 1. MAQSAD

Vaqtinchalik delegatsiya jarayonini to'liq shaffof qilish — xodimlar va rahbariyat o'rtasida nizo bo'lmasligi uchun har bir delegatsiya voqeasi (berish, qabul/rad etish, davomidagi amallar, tugash) ikki tomon tomonidan ham ko'riladigan audit tizimida saqlanadi.

---

## 2. QAMROV

Ushbu spec quyidagi funksiyalarni qamrab oladi:

- Delegatsiya yaratish jarayoni (majburiy sabab bilan)
- Oluvchi tomonidan qabul qilish yoki rad etish (sabab bilan)
- Delegatsiya davomida bajarilgan amallar logi
- Karta + drill-down timeline UI
- PDF eksport
- Bildirishnomalar (in-app + Telegram)
- Cron job — muddati tugagan delegatsiyalarni avtomatik yopish

**Qamrovdan tashqari:**
- Delegatsiya ruxsatlarini o'zgartirish (faol davomida)
- Bir vaqtda bir nechta delegatsiya (bitta xodimga faqat 1 ta faol delegatsiya)

---

## 3. FOYDALANUVCHI ROLLARI

| Rol | Ko'rish | Yaratish | Bekor qilish |
|-----|---------|----------|--------------|
| Superadmin | Barcha filiallar | ✅ | ✅ |
| Filadmin | O'z filiali | ✅ | ✅ (o'ziniki) |
| Manager | O'zi bergan + o'ziga berilgan | ✅ (pastki rollarga) | ✅ (o'ziniki) |
| Mentor / Tester | Faqat o'ziga berilganlar | ❌ | ❌ |

---

## 4. ASOSIY JARAYON (Flow)

```
Beruvchi (Superadmin / Filadmin / Manager)
  ↓
Delegatsiya yaratadi:
  - Oluvchi tanlaydi
  - Muddat: boshlanish + tugash sanasi
  - Ruxsatlar ro'yxati (JSON array)
  - Sabab — MAJBURIY matn maydoni
  ↓
Oluvchiga notification (in-app + Telegram):
  "Sizga vaqtinchalik [rol] vakolati berildi
   Muddat: [sana — sana]
   Sabab: [sabab matni]
   Siz bajara olasiz: [ruxsatlar ro'yxati]
   [✅ Qabul qilaman] [❌ Rad etaman]"
  ↓
          ↙                     ↘
    QABUL QILDI              RAD ETDI
    (sabab ixtiyoriy)        (sabab MAJBURIY)
         ↓                        ↓
    status: active           status: rejected
    Vakolatlar faollashadi   Beruvchiga xabar:
    Beruvchiga xabar         "Rad etildi: [sabab]"
         ↓
    Davomidagi har amal
    delegation_audit_log ga yoziladi
    + tegishli jadvalda delegation_id saqlanadi
         ↓
    Muddat tugadi (cron) / Beruvchi bekor qildi
         ↓
    status: completed / cancelled
    Vakolatlar avtomatik olinadi
    Ikki tomonga yakuniy xabar
```

### Holat Sxemasi

```
pending → active → completed
       ↘    ↓
    rejected cancelled
             (beruvchi istalgan vaqt bekor qilishi mumkin)
```

---

## 5. MA'LUMOTLAR MODELI

```sql
delegations
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  branch_id        UUID NOT NULL
  from_user_id     UUID NOT NULL          -- beruvchi
  to_user_id       UUID NOT NULL          -- oluvchi
  delegated_role   ENUM(filadmin, manager)
  permissions      JSONB NOT NULL         -- ['warnings','payments','staff_manage',...]
  reason           TEXT NOT NULL          -- sabab (majburiy)
  starts_at        TIMESTAMPTZ NOT NULL
  ends_at          TIMESTAMPTZ NOT NULL
  status           ENUM(pending, active, completed, cancelled, rejected)
  cancelled_at     TIMESTAMPTZ
  cancelled_by     UUID                   -- kim bekor qildi
  cancel_reason    TEXT                   -- bekor qilish sababi
  created_at       TIMESTAMPTZ DEFAULT NOW()

delegation_responses
  id               UUID PRIMARY KEY
  delegation_id    UUID REFERENCES delegations(id)
  action           ENUM(accepted, rejected)
  reason           TEXT                   -- rad etilsa majburiy
  responded_at     TIMESTAMPTZ DEFAULT NOW()

delegation_audit_log
  id               UUID PRIMARY KEY
  delegation_id    UUID REFERENCES delegations(id)
  actor_id         UUID NOT NULL          -- kim bajardi
  action_type      TEXT NOT NULL          -- warning_given, payment_marked, staff_added...
  target_id        UUID                   -- kimga/nimaga nisbatan
  meta             JSONB                  -- amal tafsiloti
  performed_at     TIMESTAMPTZ DEFAULT NOW()
```

**Mavjud jadvallar yangilanadi:**
```sql
-- Delegat sifatida bajarilganligini belgilash uchun
ALTER TABLE warnings     ADD COLUMN delegation_id UUID REFERENCES delegations(id);
ALTER TABLE payments     ADD COLUMN delegation_id UUID REFERENCES delegations(id);
ALTER TABLE kpi_scores   ADD COLUMN delegation_id UUID REFERENCES delegations(id);
```

**Cheklov:** Bir xodimga bir vaqtda faqat 1 ta `active` delegatsiya bo'lishi mumkin.
```sql
CREATE UNIQUE INDEX one_active_delegation_per_user
  ON delegations(to_user_id)
  WHERE status = 'active';
```

---

## 6. UI/UX

### 6.1 Asosiy Sahifa — "Delegatsiyalar"

Har bir rol uchun navigatsiya menyusida "Delegatsiyalar" bo'limi:

```
┌─────────────────────────────────────────────────┐
│ DELEGATSIYALAR                    [+ Yangi]      │
│                                                  │
│ [Faol]  [Kutilmoqda]  [Tarix]  [Rad etilgan]   │
├─────────────────────────────────────────────────┤
│ 🟢 Nodira Karimova → Alisher Toshev             │
│    Filadmin vakolati  •  3–10 may               │
│    Sabab: "Filadmin ta'tilda"        [Ko'rish →] │
├─────────────────────────────────────────────────┤
│ ⏳ Bobur Yusupov → Kamola Nazarova              │
│    Manager vakolati  •  Kutilmoqda              │
│    Sabab: "Kasalxonada"              [Ko'rish →] │
├─────────────────────────────────────────────────┤
│ ✅ 15–20 aprel  •  Nodira → Alisher             │
│    12 ta amal bajarildi              [Ko'rish →] │
└─────────────────────────────────────────────────┘
```

**Holat badge'lari:**
- 🟢 Faol
- ⏳ Kutilmoqda (oluvchi hali javob bermagan)
- ✅ Tugadi
- ❌ Rad etildi
- 🚫 Bekor qilindi

### 6.2 Drill-down — Timeline Sahifasi

```
┌─────────────────────────────────────────────────┐
│ ←  Nodira → Alisher  •  3–10 may  •  🟢 Faol  │
│    Sabab: "Filadmin ta'tilda"           [📄 PDF] │
│    Ruxsatlar: Ogohlantirish, To'lov, Xodim      │
├─────────────────────────────────────────────────┤
│ 3-may  09:14   📤  Nodira delegatsiya yaratdi   │
│                    Sabab: "Filadmin ta'tilda"   │
│                                                  │
│ 3-may  09:31   ✅  Alisher qabul qildi          │
│                    "Tushundim, bajaraman"        │
│                                                  │
│ 4-may  11:20   ⚠️   Alisher — ogohlantirish     │
│                    O'quvchi: Sardor Rahimov      │
│                    Sabab: Darsga tayyorlanmagan  │
│                                                  │
│ 5-may  14:05   💳  Alisher — to'lov belgiladi   │
│                    Malika Yusupova  •  450,000 so'm │
│                                                  │
│ 10-may 00:00   ✅  Muddat tugadi (avtomatik)    │
└─────────────────────────────────────────────────┘
```

### 6.3 Ko'rinish Qoidalari

| Foydalanuvchi | Ko'radi |
|---------------|---------|
| Superadmin | Barcha delegatsiyalar, barcha filiallar |
| Filadmin | O'z filialdagi delegatsiyalar |
| Beruvchi | O'zi yaratgan delegatsiyalar |
| Oluvchi | O'ziga berilgan delegatsiyalar |

---

## 7. BILDIRISHNOMALAR

| Voqea | Kim oladi | Kanal |
|-------|-----------|-------|
| Delegatsiya yaratildi | Oluvchi | In-app + Telegram |
| Qabul qilindi | Beruvchi | In-app |
| Rad etildi | Beruvchi | In-app + Telegram |
| Muddat tugashiga 1 kun | Ikkalasi | In-app |
| Delegatsiya tugadi | Ikkalasi | In-app |
| Bekor qilindi | Oluvchi | In-app + Telegram |

---

## 8. API ENDPOINTLAR

```
POST   /delegations                    → Yangi delegatsiya yaratish
GET    /delegations                    → Ro'yxat (filtr: status, branch, user)
GET    /delegations/:id                → Tafsilot + ruxsatlar
GET    /delegations/:id/audit-log      → Timeline voqealari
POST   /delegations/:id/respond        → Qabul/rad etish (oluvchi)
PATCH  /delegations/:id/cancel         → Bekor qilish (beruvchi)
GET    /delegations/:id/export         → PDF eksport
```

**Standart javob formati (mavjud TZ bilan mos):**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2026-04-24T10:00:00Z" }
}
```

---

## 9. CRON JOB

| Vazifa | Jadval | Tavsif |
|--------|--------|--------|
| Delegatsiya muddati tekshirish | Har kuni 00:01 | `ends_at` o'tgan `active` delegatsiyalar → `completed`, vakolatlar olinadi, ikki tomonga xabar |
| Muddatga 1 kun qoldi eslatma | Har kuni 09:00 | `ends_at = ertaga` bo'lgan faol delegatsiyalar → eslatma |

---

## 10. XATO HOLATLARI

| Xato | Tizim reaksiyasi |
|------|-----------------|
| Oluvchida allaqachon faol delegatsiya bor | "Bu xodimda faol delegatsiya mavjud" — yangi delegatsiya bloklanadi |
| Beruvchi delegatsiyani bekor qilmoqchi, lekin tugagan | "Delegatsiya allaqachon tugagan" |
| Oluvchi muddat o'tgandan keyin javob bermoqchi | "Delegatsiya muddati o'tdi" — javob qabul qilinmaydi |
| Cron job ishlamay qoldi | Monitoring alert → DevOps; qo'lda trigger imkoni |

---

## 11. MAVJUD TZ BILAN BOG'LIQLIK

Bu spec asosiy TZ `2026-04-23-alochi-platform-design.md` ning **Section 2.3** (Vaqtinchalik Delegatsiya) bo'limini kengaytiradi.

**Faza:** Faza 1 MVP ga qo'shish tavsiya etiladi — ishonch va shaffoflik asosiy tizim bilan birga kerak.

---

*Delegatsiya audit tizimi — xodimlar va rahbariyat o'rtasidagi shaffoflikni ta'minlash uchun.*

---

## 12. QABUL MEZONLARI (UAT)

| Mezon | Muvaffaqiyat |
|-------|-------------|
| Delegatsiya yaratish | Sabab maydoni bo'sh bo'lsa → saqlash bloklanadi |
| Oluvchi notification | Delegatsiya yaratilgandan 30 soniya ichida in-app + Telegram keladi |
| Ruxsatlar ro'yxati | Oluvchi notification da nima qila olishi aniq ko'rsatiladi |
| Qabul qilish | Qabul bosish bilan vakolatlar darhol kuchga kiradi |
| Rad etish | Sabab bo'sh bo'lsa rad etish bloklanadi; beruvchiga notification ketadi |
| Audit logi | Delegat sifatida berilgan ogohlantirish timelineda ko'rinadi |
| PDF eksport | PDF to'g'ri ma'lumotlar bilan yuklab olinadi |
| Muddat tugashi | Cron job 00:01 da ishlaydi, vakolatlar avtomatik olinadi |
| Ikki tomon ko'rinishi | Beruvchi o'z bergan, oluvchi o'ziga berilgan delegatsiyani ko'radi |
| Takroriy delegatsiya | Faol delegatsiyasi bor xodimga yangi delegatsiya berib bo'lmaydi |
