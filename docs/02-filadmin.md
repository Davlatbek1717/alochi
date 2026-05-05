# Filadmin — To'liq Qo'llanma

> **Rol:** Markaz direktori / filial boshqaruvchisi. O'z markazidagi
> xodimlar, o'quvchilar, to'lovlar va umumiy boshqaruv.
> **Login sahifasi:** `/login`

---

## Filadmin nima qila oladi?

- ✅ Markaz xodimlarini (mentor, manager, tester) boshqarish
- ✅ O'quvchilarni qo'shish va boshqarish
- ✅ Filiallar yaratish
- ✅ To'lovlarni boshqarish va bloklash
- ✅ Ogohlantirishlar berish
- ✅ Promo-hisobotlar ko'rish
- ✅ KPI monitoring
- ✅ Bloklangan o'quvchilarni ko'rish
- ✅ Musobaqa (tournament) yaratish
- ✅ Davomat boshqarish

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/filadmin`)

**Nima ko'rsatiladi:**
- Bugungi xulosa: qizil/sariq/yashil o'quvchilar soni
- Faol o'quvchilar vs kutilayotgan soni
- To'lov bo'yicha ogohlantirishlar
- Bugungi davomat

**Kunlik ish:** Bosh sahifada qizil va sariq sonlarni kuzating. Agar oshib ketsa — managerga signal bering.

---

### 👥 O'quvchilar (`/filadmin/students`)

**Yangi o'quvchi qo'shish:**
1. `+ Yangi o'quvchi`
2. **Ism-familiya:** `Abdullayev Ali`
3. **Login:** `ali2015` (yoki telefon raqam)
4. **Parol:** Kamida 6 ta belgi
5. **Filial:** Qaysi filianga
6. **Guruh:** (ixtiyoriy) Qaysi guruhga
7. **Viloyat / Maktab:** (landing page uchun)
8. `Saqlash`

**O'quvchi kartasi:**
- Holati: yashil/sariq/qizil
- Progress: necha dars tugatgan
- Oxirgi faollik sanasi
- `Profil ko'rish` → batafsil

**O'quvchini qidirish:**
- Ism, login yoki maktab bo'yicha

**O'quvchi guruhini o'zgartirish:**
- Karta → `Tahrirlash` → `Guruh` → yangi guruhni tanlang

---

### 🏫 Xodimlar (`/filadmin/staff`)

**Yangi xodim qo'shish:**
1. `+ Yangi xodim`
2. **Rol tanlash:** `mentor` / `manager` / `tester`
3. Ism, login, parol, filial
4. `Saqlash`

**Xodim vazifalari eslatmasi:**
| Rol | Asosiy vazifasi |
|---|---|
| **Mentor** | Guruh nazorati, status qo'yish, imtihon ruxsati |
| **Manager** | Qizil/sariq o'quvchilar, KPI, 1:1 sessiyalar |
| **Tester** | Imtihon nazorati, texnik yordam |

**Xodimni o'chirish/faolsizlashtirish:**
- `Status` → `inactive` → xodim kira olmaydi

---

### 🏢 Filiallar (`/filadmin/branches`)

**Yangi filial yaratish:**
1. `+ Yangi filial`
2. **Nomi:** `Buxoro filiali`
3. **Manzil:** (ixtiyoriy)
4. `Saqlash`

**Filial ichiga kirish:**
- Filial kartasini bosing → o'sha filial o'quvchilar, xodimlar ko'rinadi

> 💡 **Tavsiya:** Har bir filialga kamida 1 ta manager va 1 ta mentor biriktiring.

---

### 💰 To'lovlar (`/filadmin/payments`)

**To'lov holatlari:**
- 🟢 `to'langan` — joriy oy to'lov qilingan
- 🔴 `muddati o'tgan` — to'lanmagan
- ⏳ `kutilmoqda` — oyning oxirigacha vaqt bor

**O'quvchini bloklash (to'lov qilinmagan):**
1. O'quvchi → `To'lov holati` → `Muddati o'tgan` belgisi
2. `Bloklash` tugmasi
3. Sabab: `blocked_payment`
4. O'quvchi tizimga kira olmaydi

**Bloklanganni ochish (to'lov qilinganda):**
1. `Bloklangan o'quvchilar` → tegishli o'quvchi
2. `Blokni ochish` → sabab: `To'lov amalga oshirildi`

**Oylik yig'im belgilash:**
- O'quvchi kartasida to'lov miqdori va sanasi kiritiladi

---

### ⚠️ Ogohlantirishlar (`/filadmin/warnings`)

**Ogohlantirish nima:**
O'quvchi tartib buzsa yoki dars qilmasa — mentor/manager ogohlantirish beradi.
3 ta ogohlantirish → avtomatik blok (`blocked_warning`).

**Filadmin nima ko'radi:**
- Barcha ogohlantirishlar tarixi
- Kim, kimga, qachon, sababi
- Bekor qilingan ogohlantirishlar

**Ogohlantirish bekor qilish:**
1. Ogohlantirish → `Bekor qilish` tugmasi
2. Sabab kiriting
3. Agar 3 ta ogohlantirish sababli bloklangan bo'lsa → avtomatik razblok

---

### 📈 KPI (`/filadmin/kpi`)

Barcha manager va mentorlar KPI ko'rsatkichlari:

| Ko'rsatkich | Kim uchun | Ball |
|---|---|---|
| Qizil → sariq o'quvchi | Manager | +10 |
| Sariq → yashil o'quvchi | Manager | +15 |
| 1:1 sessiya o'tkazish | Manager | +5 |

**Filter:** Oy bo'yicha ko'rish

---

### 📋 Promo-hisobot (`/filadmin/promotion-report`)

O'quvchilarning darajadan-darajaga o'tish hisoboti:
- Kim qachon keyingi darajaga o'tdi
- Sertifikat olganlarga tabrik yuborish uchun ro'yxat

---

### 🚫 Bloklangan o'quvchilar (`/filadmin/blocked-students`)

Joriy markaz bloklangan o'quvchilar:
- Blok sababi (ogohlantirish/to'lov)
- Bloklanish sanasi
- `Blokni ochish` tugmasi

---

### 📊 Davomat (`/filadmin/attendance`)

Markaz bo'yicha umumiy davomat:
- Kunlik grafik
- Filial bo'yicha filter
- Export (Excel)

---

### 📱 Qurilmalar (`/filadmin/devices`)

Markazda ro'yxatdan o'tgan qurilmalar:
- Qaysi qurilmadan kim kirgan
- Ishonchli qurilmalar siyosati

---

### 📄 Face davomat (`/filadmin/face-attendance`)

Yuz aniqlash orqali belgilangan davomat:
- Kimlar yuz ID orqali, kimlar qo'lda belgilandi

---

### 🏆 Turnirlar (`/filadmin/tournaments`)

O'z markazi uchun turnir ko'rish va yaratish.

---

### 📹 Video qo'llanmalar (`/filadmin/video-guides`)

Superadmin qo'shgan o'quv videolar. O'qitish jarayonida foydalaning.

---

### ✅ Vazifalar (`/filadmin/tasks`)

Superadmin tomonidan berilgan vazifalar:
- Ko'rish, bajarish, izoh qo'shish

---

## Filadmin kunlik vazifalar

**Har kuni (10 daqiqa):**
- [ ] Bosh sahifada qizil/sariq sonini ko'ring
- [ ] Yangi to'lov muddati o'tganlarni tekshiring
- [ ] Davomat ko'rsatkichini ko'ring

**Har hafta:**
- [ ] KPI hisobotini ko'ring, yaxshi natija ko'rsatgan managerlarni rag'batlantiring
- [ ] Ogohlantirish tarixi — adolatli ekanligini tekshiring

**Oyda bir:**
- [ ] To'lovlar to'liq tekshirish — muddati o'tganlarni bloklash
- [ ] Promo-hisobot — darajadan o'tganlarni tabrik qilish
- [ ] Xodimlar bilan yig'ilish — KPI natijalariga qarab rag'bat
