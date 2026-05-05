# Mentor — To'liq Qo'llanma

> **Rol:** O'z guruhi bilan kunlik aloqa. Status belgilash, dars
> ruxsati berish, AI xato tahlili.
> **Login sahifasi:** `/login`

---

## Mentor nima qila oladi?

- ✅ O'z guruhidagi o'quvchilarni ko'rish
- ✅ O'quvchi **shaxsiy rivojlanish** statusini yashil/sariq/qizil belgilash
- ✅ O'quvchiga imtihon ruxsati berish
- ✅ Davomat belgilash
- ✅ AI xato tahlilini ko'rish (o'quvchi qaysi savolda ko'p xato qiladi)
- ✅ Vazifalar ko'rish

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/mentor`)

**Nima ko'rsatiladi:**
- Guruh umumiy holati (yashil/sariq/qizil nisbati)
- Bugungi davomat
- E'tiborga muhtoj o'quvchilar (sariq/qizil)
- So'nggi AI xato tahlili natijalari

---

### 👥 Guruh (`/mentor/group`)

Bu — mentor ishining asosiy sahifasi.

**Ko'rinish:**
- Guruhidagi barcha o'quvchilar kartochkalari
- Har birida: ism, holat rangi, oxirgi faollik, progress

#### O'quvchi statusini belgilash

> ⚠️ **Mentor faqat "Shaxsiy rivojlanish" statusini belgilaydi.**
> Tanqidiy fikrlash holati avtomatik o'zgaradi.

1. O'quvchi kartasidagi rang tugmasiga bosing
2. **Rang tanlang:**
   - 🟢 **Yashil** — bola yaxshi kelayapti, faol, motivatsiyali
   - 🟡 **Sariq** — bir oz pasayish bor, e'tibor kerak
   - 🔴 **Qizil** — kelmayapti, qiynalayapti, darhol aralashish kerak
3. **Izoh** (ixtiyoriy): `"Bugun darsda juda faol edi"`
4. `Saqlash`

> 💡 **Muhim:** Shaxsiy rivojlanishni yashil belgilasangiz → **tanqidiy fikrlash holati ham avtomatik yashilga o'tadi** va managerga xabarnoma boradi!

#### AI xato tahlili

O'quvchi qaysi savolda ko'p xato qilayotganini ko'rish:
1. O'quvchi kartasi → `AI xato tahlili` tugmasi
2. Ko'rsatiladi:
   - Eng ko'p xato qilingan mavzu
   - Xato foizi
   - AI tavsiyasi: "Bu mavzuni qayta tushuntirish kerak"

#### O'quvchiga shaxsiy dars berish

1. O'quvchi → `Dars ruxsati` tugmasi
2. Kerakli darsni tanlang
3. Sana va vaqt belgilang (ixtiyoriy)
4. `Tasdiqlash` → O'quvchi shu darsni boshlayoladi

---

### 👤 O'quvchilar (`/mentor/students`)

Barcha o'quvchilar batafsil ko'rinishi:
- Progress grafigi
- Oxirgi dars faolligi
- Xato statistikasi

---

### 📅 Davomat (`/mentor/attendance`)

**Kunlik davomat belgilash:**
1. `+ Davomat` tugmasi
2. Sana: bugun
3. Guruh tanlang
4. Har bir o'quvchi yoniga: ✅ Keldi / ❌ Kelmadi
5. `Saqlash`

> 💡 Face ID ulangan o'quvchilar avtomatik belgilanadi.

---

### ✅ Vazifalar (`/mentor/tasks`)

Filadmin yoki superadmin tomonidan berilgan vazifalar.

---

## Mentor kunlik vazifalar

**Dars boshida (2 daqiqa):**
- [ ] Davomat belgilash

**Dars davomida:**
- [ ] O'quvchilar AI bilan ishlashini kuzatish
- [ ] Qiynalayotganlarga yordam

**Dars oxirida (5 daqiqa):**
- [ ] Har bir o'quvchiga status belgilash (yashil/sariq/qizil)
- [ ] AI xato tahliliga qarang — qaysi mavzu qiyin bo'lgan

**Hafta oxirida:**
- [ ] Qizil o'quvchilarni managerga xabar bering
- [ ] Yaxshi o'quvchilarga imtihon ruxsati bering

---

## Status belgilash bo'yicha qoidalar

| Holat | Status | Sabab |
|---|---|---|
| Bola har kuni keladi, darslarini qiladi | 🟢 Yashil | Faol va motivatsiyali |
| 2-3 kun kelmadi yoki sust | 🟡 Sariq | E'tibor kerak |
| Bir hafta ko'rinmadi yoki muammo bor | 🔴 Qizil | Darhol aralashish kerak |

> 🔴 **Qizil belgilagandan keyin** — o'sha kuni manager ham ko'radi va sizga yordam beradi.
