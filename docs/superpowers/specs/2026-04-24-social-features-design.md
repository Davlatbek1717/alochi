# A'lochi — O'quvchilar Ijtimoiy Funksiyalari

**Sana:** 2026-04-24
**Versiya:** 1.0
**Loyiha:** A'lochi Platform
**Holat:** Ko'rib chiqilmoqda

---

## 1. MAQSAD

O'quvchilar o'rtasida sog'lom raqobat va hamkorlikni rag'batlantirish — mavjud gamifikatsiya tizimi (XP, streak, virtual shahar) ichiga organik tarzda to'qilgan ijtimoiy lenta, do'stlar tizimi, 1v1 duel, guruh challenge va guruh chati orqali.

---

## 2. QAMROV

- Do'stlar lentasi (gamifikatsiya dashboard ichida)
- Do'stlik tizimi (guruh — avtomatik, filial — so'rov orqali)
- 1v1 Duel (do'stlar o'rtasida test musobaqasi)
- Guruh Challenge (guruh vs guruh, 7 kunlik)
- Guruh chati (Mentor nazoratida)
- Moderatsiya tizimi (Mentor + Filadmin)

**Qamrovdan tashqari:**
- Shaxsiy (1v1) chat
- Rasm/video yuborish
- Milliy daraja do'stliklari (faqat anonim reyting)
- Ota-ona ijtimoiy funksiyalarni boshqarishi

---

## 3. DARAJA TIZIMI

| Daraja | Doira | Do'stlik | Reyting | Chat |
|--------|-------|---------|---------|------|
| Guruh | O'z sinfi | Avtomatik | To'liq profil | ✅ Guruh chati |
| Filial | Bir markaz | So'rov orqali | Yutuqlar + XP | ❌ |
| Milliy | Barcha markazlar | ❌ | Anonim reyting | ❌ |

**Yosh cheklovi:** 13 yoshdan kichik o'quvchilar faqat guruh darajasida ishlaydi — filial darajasida do'st so'rovi bloklanadi.

---

## 4. IJTIMOIY LENTA

Mavjud gamifikatsiya dashboard ga "Do'stlar Lentasi" bloki qo'shiladi.

### 4.1 Lenta Voqealari

| Voqea | Lentada ko'rinishi |
|-------|-------------------|
| Dars tugatildi | "Sardor Dars #47 ni o'tdi! +100 XP" |
| Streak milestone | "Malika 30 kun streak! 🔥" |
| Sertifikat olindi | "Jasur Gold A'lochi sertifikat oldi! 🏅" |
| Duel g'alaba | "Sardor Alisherni duelda yendi! 8/10 vs 6/10" |
| Streak uzildi | "Bobur streaki uzildi (7 kun edi)" |
| Virtual shahar yangilandi | "Nodira shaharchasini qurdi! 🏘️" |

### 4.2 Lenta UI

```
┌─────────────────────────────────────────────────┐
│ DO'STLAR LENTASI                    [Hammasi →] │
├─────────────────────────────────────────────────┤
│ 🟢 Sardor  •  Dars #48 ni o'tdi!       2 min  │
│    +100 XP  •  🔥 15 kun streak                │
│    [👍]  [⚡ Duelga chaqir]                    │
│                                                  │
│ 🏅 Malika  •  Gold sertifikat oldi!            │
│    [🎉]                                         │
│                                                  │
│ 🔴 Jasur  •  Streak uzildi (7 kun edi)         │
│    [💪]                                         │
└─────────────────────────────────────────────────┘
```

**Reakciyalar:** Faqat tayyor emoji to'plami — 👍 🎉 💪 🔥 ❤️

---

## 5. DO'STLAR TIZIMI

### 5.1 Jarayon

```
Guruh darajasi (avtomatik):
  Guruh tuzilganda → barcha a'zolar do'st bo'ladi
  Yangi o'quvchi guruhga qo'shilsa → avtomatik do'st

Filial darajasi (so'rov orqali, 13+ yosh):
  O'quvchi A → "Do'st qo'shish" → O'quvchi B
  B notification oladi: "[Ism] do'st bo'lishni so'ramoqda"
  [✅ Qabul] [❌ Rad]
  Qabul → filial do'stlari ro'yxatiga
```

### 5.2 Holat Sxemasi

```
pending → accepted
       ↘ rejected
```

### 5.3 Do'stlar Sahifasi

```
┌─────────────────────────────────────────────────┐
│ DO'STLARIM                                       │
│ [Guruh (12)] [Filial (5)] [So'rovlar (2)]       │
├─────────────────────────────────────────────────┤
│ 👤 Sardor Rahimov    •  🔥 15 streak            │
│    2,340 XP  •  Dars #48                        │
│    [⚡ Duelga chaqir]                           │
├─────────────────────────────────────────────────┤
│ 👤 Malika Yusupova   •  🏅 Gold sertifikat      │
│    5,120 XP  •  Dars #89                        │
│    [⚡ Duelga chaqir]                           │
└─────────────────────────────────────────────────┘
```

---

## 6. 1V1 DUEL

### 6.1 Jarayon

```
O'quvchi A → do'st lentasidan "⚡ Duelga chaqir"
  ↓
O'quvchi B notification:
  "Sardor sizi duelga chaqirdi! 24 soat vaqtingiz bor."
  [✅ Qabul] [❌ Rad]
  ↓
Qabul qilinsa → Duel yaratiladi:
  - Bir xil 10 ta savol (ikki o'quvchi ham o'tgan darslardagi MCQ testlardan random)
  - Har biri mustaqil o'z vaqtida yechadi (24 soat)
  - Ball = to'g'ri javoblar + tezlik bonus
  ↓
24 soat o'tganda yoki ikkalasi ham yechganda:
  G'olib: +150 XP + "Duel G'olibi" kunlik badge
  Yutqazgan: +30 XP (ishtirok uchun)
  ↓
Lentada: "Sardor Jasurni duelda yendi! 8/10 vs 6/10"
```

### 6.2 Duel UI

```
Natija sahifasi:
┌─────────────────────────────────────────────────┐
│              ⚡ DUEL NATIJASI                   │
├─────────────────────┬───────────────────────────┤
│ Sardor              │           Jasur            │
│ 8/10  ✅ G'OLIB    │      6/10  ❌             │
│ +150 XP             │      +30 XP               │
│ Vaqt: 4:32          │      Vaqt: 6:18           │
└─────────────────────┴───────────────────────────┘
│           [🔄 Qaytadan duel] [← Orqaga]         │
└─────────────────────────────────────────────────┘
```

### 6.3 Cheklovlar

- Bir vaqtda max 2 ta faol duel
- Rad etilgan duel → rad etuvchiga jarima yo'q
- 24 soat o'tsa va ikkinchi o'quvchi o'ynamasа → muddati tugagan, challenger +50 XP

---

## 7. GURUH CHALLENGE

### 7.1 Jarayon

```
Mentor yoki guruh sardori (eng yuqori XP) →
  Boshqa guruhga challenge yuboradi
  ↓
Opponent guruh sardori notification:
  "[5A guruh] sizni haftalik challengega chaqirdi!"
  [✅ Qabul] [❌ Rad]
  ↓
Qabul → 7 kunlik challenge boshlanadi:
  Maqsad: guruh a'zolari yig'gan umumiy XP
  ↓
Davomida real-time progress:
  ┌────────────────────────────────┐
  │ 5A  ████████░░  4,200 XP      │
  │ 5B  ██████░░░░  3,100 XP      │
  │ Qoldi: 3 kun                  │
  └────────────────────────────────┘
  ↓
7 kun tugaganda:
  G'olib guruh: +500 XP (har a'zoga) + guruh trofeyi
  Yutqazgan: +100 XP (ishtirok uchun)
  Lentada: "5A guruhi 5B ni challengeda yendi! 🏆"
```

### 7.2 Cheklovlar

- Guruh oyiga max 2 ta challenge
- Bir vaqtda max 1 ta faol challenge
- Faqat bir filial ichidagi guruhlar o'rtasida

---

## 8. GURUH CHATI

### 8.1 Chat UI

```
┌─────────────────────────────────────────────────┐
│ 💬 5A Guruh Chati              [Mentor: Nodira] │
├─────────────────────────────────────────────────┤
│  Sardor  09:14                                  │
│  ┌──────────────────────────┐                   │
│  │ Dars #47 ni o'tdim! 🎉  │                   │
│  └──────────────────────────┘                   │
│                         Malika  09:16           │
│                   ┌──────────────────────┐      │
│                   │ Barakalla! Men ham   │      │
│                   │ bugun o'taman 💪    │      │
│                   └──────────────────────┘      │
│  📌 Mentor Nodira  09:20                        │
│  ┌──────────────────────────────────────┐       │
│  │ Bugun 15:00 da dars. Tayyor bo'ling! │       │
│  └──────────────────────────────────────┘       │
├─────────────────────────────────────────────────┤
│ [😊] [✍️ Xabar yozing...]         [➤ Yuborish] │
└─────────────────────────────────────────────────┘
```

### 8.2 Xabar Turlari

| Tur | O'quvchi | Mentor |
|-----|---------|--------|
| Matnli xabar (max 200 belgi) | ✅ | ✅ |
| Emoji reakciya (👍🎉💪🔥❤️) | ✅ | ✅ |
| Pinlangan xabar | ❌ | ✅ |
| Rasm/video | ❌ | ❌ |
| Shaxsiy xabar | ❌ | ❌ |

**Cheklovlar:**
- O'quvchi 24 soatda max 20 ta xabar
- Xabar max 200 belgi

### 8.3 Moderatsiya Jarayoni

```
O'quvchi xabar yozadi
  ↓
Avtomatik filtr (Superadmin boshqaradigan kalit so'zlar ro'yxati)
  ↓
       ↙ Toza               ↘ Shubhali
  Darhol yuboriladi    Mentorga ko'rinadi:
                       "Ushbu xabarni tasdiqlaysizmi?"
                            ↓
                   ✅ Tasdiq → Yuboriladi
                   ❌ Rad → O'chiriladi
                           + O'quvchiga ogohlantirish
```

### 8.4 Moderator Imkoniyatlari

| Amal | Mentor | Filadmin |
|------|--------|----------|
| Chatni ko'rish | O'z guruhi | Barcha guruhlar |
| Xabar o'chirish | O'z guruhi | Barcha |
| O'quvchini chatdan chiqarish (1 kun) | O'z guruhi | Barcha |
| Chatni to'liq yopish | ❌ | ✅ |
| Pinlangan xabar | ✅ | ✅ |

---

## 9. MA'LUMOTLAR MODELI

```sql
friendships
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  requester_id     UUID REFERENCES users(id)
  receiver_id      UUID REFERENCES users(id)
  scope            ENUM(group, branch)
  status           ENUM(pending, accepted, rejected)
  created_at       TIMESTAMPTZ DEFAULT NOW()
  UNIQUE(requester_id, receiver_id)

duels
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  challenger_id    UUID REFERENCES users(id)
  opponent_id      UUID REFERENCES users(id)
  questions        JSONB NOT NULL        -- 10 ta savol snapshot
  status           ENUM(pending, active, completed, expired)
  challenger_score FLOAT
  opponent_score   FLOAT
  winner_id        UUID REFERENCES users(id)
  expires_at       TIMESTAMPTZ           -- created_at + 24 soat
  created_at       TIMESTAMPTZ DEFAULT NOW()

group_challenges
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  challenger_group_id  UUID NOT NULL
  opponent_group_id    UUID NOT NULL
  status           ENUM(pending, active, completed, rejected)
  challenger_xp    INT DEFAULT 0
  opponent_xp      INT DEFAULT 0
  winner_group_id  UUID REFERENCES users(id)
  starts_at        TIMESTAMPTZ
  ends_at          TIMESTAMPTZ           -- starts_at + 7 kun
  created_at       TIMESTAMPTZ DEFAULT NOW()

social_feed_events
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  actor_id         UUID REFERENCES users(id)
  event_type       TEXT NOT NULL
    -- lesson_done | streak_milestone | cert_earned
    -- duel_won | challenge_won | city_upgraded
  meta             JSONB
  created_at       TIMESTAMPTZ DEFAULT NOW()

group_messages
  id               UUID PRIMARY KEY
  tenant_id        UUID NOT NULL
  group_id         UUID NOT NULL
  sender_id        UUID REFERENCES users(id)
  content          TEXT NOT NULL         -- max 200 belgi
  is_pinned        BOOLEAN DEFAULT FALSE
  moderation_status ENUM(approved, pending, rejected) DEFAULT approved
  created_at       TIMESTAMPTZ DEFAULT NOW()

message_reactions
  message_id       UUID REFERENCES group_messages(id)
  user_id          UUID REFERENCES users(id)
  emoji            TEXT NOT NULL         -- '👍'|'🎉'|'💪'|'🔥'|'❤️'
  PRIMARY KEY(message_id, user_id)

chat_bans (vaqtinchalik chatdan chiqarish)
  id               UUID PRIMARY KEY
  student_id       UUID REFERENCES users(id)
  group_id         UUID NOT NULL
  banned_by        UUID REFERENCES users(id)
  banned_until     TIMESTAMPTZ
  reason           TEXT
  created_at       TIMESTAMPTZ DEFAULT NOW()
```

---

## 10. API ENDPOINTLAR

```
FRIENDS:
POST   /friends/request/:userId      → Do'stlik so'rovi (filial, 13+)
PATCH  /friends/:id/respond          → Qabul/rad
GET    /friends                      → Do'stlar ro'yxati
GET    /friends/feed                 → Ijtimoiy lenta

DUELS:
POST   /duels                        → Duelga chaqirish
PATCH  /duels/:id/respond            → Qabul/rad
POST   /duels/:id/submit             → Javoblar yuborish
GET    /duels/:id/result             → Natija
GET    /duels                        → Faol/tugagan duellar

GROUP CHALLENGES:
POST   /challenges                   → Challenge yuborish
PATCH  /challenges/:id/respond       → Qabul/rad
GET    /challenges/:id/progress      → Joriy XP holati

CHAT:
GET    /groups/:id/messages          → Xabarlar (pagination: 50 ta)
POST   /groups/:id/messages          → Xabar yuborish
DELETE /groups/:id/messages/:msgId   → O'chirish (Mentor/Filadmin)
POST   /groups/:id/messages/:msgId/pin → Pinlash/unpin
POST   /groups/:id/messages/:msgId/react → Reakciya
POST   /groups/:id/ban/:studentId    → Chatdan chiqarish
```

**WebSocket Events (real-time):**
```
→ chat:message        Yangi xabar
→ chat:reaction       Yangi reakciya
→ duel:challenged     Duelga chaqirildi
→ duel:result         Duel yakunlandi
→ challenge:update    Challenge XP yangilandi
→ feed:event          Yangi lenta voqeasi
```

---

## 11. XAVFSIZLIK VA PDPL

| Talab | Yechim |
|-------|--------|
| 13 yoshdan kichik | Faqat guruh darajasi; filial do'st so'rovi bloklanadi |
| Chat moderatsiya | Kalit so'z filtr + Mentor tasdiqi |
| Shaxsiy ma'lumot | Milliy reytingda ismlar ko'rsatilmaydi (anonim) |
| Ma'lumot saqlash | O'zbekiston serverida (PDPL §533) |
| Xabar tarixi | 90 kun saqlanadi, keyin o'chiriladi |

---

## 12. MAVJUD TZ BILAN BOG'LIQLIK

Bu spec asosiy TZ **Section 17** (Ilgor Gamifikatsiya) ni kengaytiradi va yangi **Social** bo'limini qo'shadi.

**Faza:** Faza 3 da qo'shish tavsiya etiladi — gamifikatsiya (Faza 2) ishga tushgandan keyin.

**Bog'liq bo'limlar:**
- Section 17.5 (Turnirlar) — guruh challenge turnirlardan alohida
- Section 11.3 (Ma'lumotlar modeli) — `users`, `student_status` jadvallar bilan bog'liq
- Section 25.3 (WebSocket) — yangi real-time eventlar qo'shiladi

---

*Ijtimoiy funksiyalar — o'quvchilarni platforma bilan uzoqroq bog'lab turadigan eng kuchli mexanizm.*

---

## 13. QABUL MEZONLARI (UAT)

| Mezon | Muvaffaqiyat |
|-------|-------------|
| Ijtimoiy lenta | Do'st dars tugatsa 1 daqiqa ichida lentada ko'rinadi |
| Guruh do'stlari | Guruhga qo'shilganda barcha guruh a'zolari avtomatik do'st bo'ladi |
| Filial do'stlik so'rovi | So'rov yuborilganda oluvchi notification oladi; qabul/rad ishlaydi |
| 13 yosh cheklovi | 13 yoshdan kichik o'quvchi filial darajasida do'st so'rovi yubora olmaydi |
| 1v1 Duel | Ikki o'quvchi bir xil savollarni alohida yechadi; to'g'ri natija hisoblanadi |
| Duel muddati | 24 soat o'tsa va raqib o'ynamasa → duel "muddati tugagan" deb yopiladi |
| Guruh challenge | 7 kun davomida XP real-time yangilanib turadi |
| Guruh chati | Xabar yuborilib 2 soniya ichida barcha guruh a'zolarida ko'rinadi |
| Chat filtri | Taqiqlangan so'z yuborilsa Mentorga tasdiqlash so'rovi keladi |
| Moderatsiya | Mentor xabar o'chirsa o'sha xabar barcha ekranlaridan yo'qoladi |
| 20 xabar cheklovi | 21-xabar yuborishga urinishda "Kunlik limit to'ldi" xabari chiqadi |
