# Tester — To'liq Qo'llanma

> **Rol:** Imtihon nazoratchi va texnik yordam mutaxassisi.
> **Login sahifasi:** `/login`

---

## Tester nima qila oladi?

- ✅ Imtihon navbatini boshqarish
- ✅ Imtihon jarayonini nazorat qilish
- ✅ Texnik muammolarni ko'rish va hal qilish
- ✅ Davomat belgilash (imtihon sessiyasi uchun)
- ✅ Darslar ro'yxatini ko'rish
- ✅ Vazifalar ko'rish

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/tester`)

**Nima ko'rsatiladi:**
- Imtihon navbatidagi o'quvchilar soni
- Bugungi o'tilgan imtihonlar
- Hal qilinmagan texnik muammolar

---

### 📋 Imtihon navbati (`/tester/exam-queue`)

Bu — testerning asosiy sahifasi.

**Imtihon qanday ishlaydi:**
1. Mentor o'quvchiga imtihon ruxsati beradi
2. O'quvchi navbatga qo'shiladi
3. Tester navbatni ko'radi va imtihonni boshlatadi
4. O'quvchi imtihonni yechadi
5. Tester natijani tasdiqlaydi

#### Navbatni ko'rish

Jadval ko'rinishida:
- **O'quvchi ismi**
- **Dars / imtihon nomi**
- **Kutish vaqti** (qancha vaqtdan beri kutayapti)
- **Holat:** `kutmoqda` / `imtihonda` / `yakunlandi`

#### Imtihon boshlash

1. Navbatdagi o'quvchi → `Boshlash` tugmasi
2. Holat `imtihonda` ga o'zgaradi
3. O'quvchi ekranida imtihon avtomatik aktivlanadi
4. Tester kuzatib turadi (haqiqiy sinfxona yoki video)

#### Imtihon yakunlash

- Imtihon o'zi avtomatik yakunlanadi (barcha savollar tugaganda)
- Yoki texnik muammo bo'lsa tester `To'xtatish` bosishi mumkin

---

### 🖥️ Darslar (`/tester/lessons`)

Darslar ro'yxatini ko'rish (faqat ko'rish, tahrirlash imkoni yo'q):
- Qaysi darslar nashr qilingan
- Har bir darsning komponentlari
- Imtihon ulangan darslar

---

### 🔧 Texnik muammolar (`/tester/tech-issues`)

O'quvchilar texnik muammo bildirsa (kamera ishlamayapti, audio chiqmayapti va h.k.) — shu yerda chiqadi.

**Muammo holatlari:**
- 🆕 `yangi` — o'quvchi hozirgina bildirdi
- 👁️ `ko'rildi` — tester ko'rdi
- ✅ `hal qilindi` — muammo bartaraf etildi

**Hal qilish jarayoni:**
1. Muammoni oching
2. `Ko'rindi` ni belgilang — o'quvchi biladiki uning muammosi qabul qilindi
3. Telefon/sinfxona orqali yordam bering
4. `Hal qilindi` → izoh kiriting: `"Brauzer yangilash yordam berdi"`

**Tez-tez uchraydigan muammolar:**

| Muammo | Yechim |
|---|---|
| Kamera ishlamayapti | Brauzer ruxsatlarini tekshiring |
| Mikrofon sezilmayapti | Mikrofon ruxsati, boshqa ilovalar band emas? |
| Dars yuklanmayapti | Sahifani yangilash (F5) |
| AI javob bermayapti | Internet bor? Qayta urinib ko'ring |
| Imtihon boshlanmayapti | Mentor ruxsat berganmi? |

---

### 📅 Davomat (`/tester/tasks`)

Imtihon sessiyasi uchun davomat belgilash.

---

### ✅ Vazifalar

Superadmin yoki filadmin tomonidan berilgan vazifalar.

---

## Tester kunlik vazifalar

**Har kuni:**
- [ ] Imtihon navbatini kuzating
- [ ] Yangi texnik muammolarni ko'ring va `ko'rildi` belgilang

**Imtihon vaqtida:**
- [ ] Navbatdagi o'quvchini kuzatib turing
- [ ] Imtihon muddatini nazorat qiling
- [ ] Muammo bo'lsa darhol aralashing

---

## Tester bo'lish uchun tavsiyalar

1. **Aloqa texnologiyasini biling** — imtihon paytida o'quvchi bilan aloqa (chat, video)
2. **Sabr bilan kuzating** — o'quvchi imtihon paytida tartibni buzmasligi uchun
3. **Tez harakatlaning** — texnik muammo kelsa, 5 daqiqada hal qiling
4. **Yozing** — har bir muammo va yechimni tizimda yozib qoldiring
