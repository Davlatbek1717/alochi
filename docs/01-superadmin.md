# Superadmin — To'liq Qo'llanma

> **Rol:** Platforma egasi. Barcha markazlar, darslar va tizim sozlamalari ustidan to'liq nazorat.
> **Login sahifasi:** `/login` → login: `superadmin`

---

## Superadmin nima qila oladi?

- ✅ Yangi markaz (tenant) yaratish va boshqarish
- ✅ Barcha rollar uchun foydalanuvchi yaratish
- ✅ Darslar va dars komponentlarini yaratish
- ✅ Imtihonlar yaratish va ulash
- ✅ Landing sahifani CMS orqali tahrirlash
- ✅ Barcha markazlar statistikasini ko'rish
- ✅ Murojaat so'rovlarini (demo request) boshqarish
- ✅ Sertifikat dizaynini sozlash
- ✅ Kalit so'zlar, video qo'llanmalar, shablonlar boshqarish
- ✅ Raqobat (tournament) yaratish
- ✅ Adaptiv o'rganish parametrlarini sozlash

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/superadmin`)

**Nima ko'rsatiladi:**
- Jami tenantlar soni
- Jami faol o'quvchilar
- Bugungi yangi ro'yxatdan o'tuvchilar
- Tizim sog'lig'i (API, DB, AI holati)
- So'nggi faoliyat lenti

**Kunlik ish:** Tizim sog'lig'ini tekshiring, yangi demo so'rovlarini ko'ring.

---

### 🏢 Tenantlar (`/superadmin/tenants`)

**Vazifa:** Har bir o'quv markazi — bu bir "tenant". Yangi markaz olinganda shu yerda yaratiladi.

**Yangi tenant yaratish:**
1. `+ Yangi` tugmasi
2. **Nomi:** `ABC English Center`
3. **Slug:** `abc-english` (URL uchun — faqat kichik harf va tire)
4. **Ogohlantirish limiti:** 3 (3 ta ogohlantirish → o'quvchi bloklanadi)
5. `Saqlash`

**Tenant sozlamalari:**
- `Sozlamalar` tugmasi → sertifikat shabloni, blok limiti o'zgartiriladi
- `Ko'rish` → o'sha tenant ichiga kirish (filadmin ko'rinishida)

**Tenant faolsizlashtirish:**
- `Isactive = false` → tenant foydalanuvchilari kira olmaydi
- To'lov kelmasa shu yo'l bilan bloklash

---

### 👥 Foydalanuvchilar (`/superadmin/users`)

**Vazifa:** Barcha rollardagi barcha foydalanuvchilarni boshqarish.

**Yangi foydalanuvchi yaratish:**
1. `+ Yangi` tugmasi
2. **Tenant** tanlang (qaysi markazga tegishli)
3. **Rol** tanlang: `filadmin`, `manager`, `mentor`, `tester`, `student`
4. **Ism:** To'liq ism-familiya
5. **Login:** (telefon yoki istalgan noyob qiymat)
6. **Parol:** Kamida 6 ta belgi
7. **Filial** (ixtiyoriy): Qaysi filianga biriktiriladi
8. `Saqlash`

**Foydalanuvchini qidirish/filter:**
- Tenant bo'yicha: dropdown'dan tanlang
- Rol bo'yicha: `student`, `mentor` va h.k.
- Ism bo'yicha: qidiruv maydoni

**Foydalanuvchi tahrirlash:**
- Ism, login, parol o'zgartirish
- Filial va guruh o'zgartirish
- Rol o'zgartirish (ehtiyot bo'ling!)

**Parolni reset qilish:**
- `Parolni tiklash` tugmasi → yangi parol kiriting → `Saqlash`

---

### 📚 Darslar (`/superadmin/lessons`)

**Vazifa:** Barcha o'quvchilar o'tadigan darslar majmuasini yaratish va tartiblashtirish.

#### Yangi dars yaratish

1. `+ Yangi dars` tugmasi
2. **Sarlavha:** `Lesson 1 — Greetings`
3. **Tartib raqami:** 1 (o'quvchi shu tartibda boradi)
4. **YouTube URL** (ixtiyoriy): dars video havola
5. **AI tutor konteksti:** Dars mavzusini tushuntiradigan matn.
   > Misol: "Bu dars 'Salom va xayrlashuv' mavzusida. Hello, Hi, Good morning, Good afternoon, Goodbye, See you — so'zlari o'rganiladi."
6. **Takrorlash soni (N):** O'quvchi shu darsni necha marta tugatishi kerak (odatda 1)
7. **Kamera yoqilsin?** Akademiya topshiriqlarida yuz aniqlash kerakmi
8. `Saqlash`

#### Dars komponentlari qo'shish

Dars yaratgandan keyin → `Komponentlar` bo'limi:

| Komponent | Nima qiladi | Miqdor tavsiyasi |
|---|---|---|
| `vocabulary` | So'z lug'ati kartochkalari | 5-10 so'z |
| `flash_card` | Ikki tomonlama kartochka | 5-15 ta |
| `speak_sentence` | Talaffuz mashqi | 3-8 jumla |
| `mcq` | Test savollar | **kamida 10 ta** (duel + imtihon uchun) |
| `fill_blank` | Bo'sh joy to'ldirish | 5-10 ta |
| `match_pairs` | Juftliklar topish | 4-8 juft |

> ⚠️ **Muhim:** Duelda va imtihonda `mcq` komponentidan savollar olinadi.
> Agar darsda 10 ta'dan kam `mcq` savol bo'lsa — duel yaratib bo'lmaydi.

#### Darsni nashr qilish

- `Nashr qilish` tugmasi → o'quvchilarga ko'rinadi
- Nashr qilinmagan darslar faqat superadmin ko'radi

---

### 📝 Imtihonlar (`/superadmin/exams`)

**Vazifa:** Katalog imtihonlarini (catalogue exam) yaratish.
Bu — darsga bog'liq bo'lmagan mustaqil imtihonlar.

**Yangi imtihon:**
1. `+ Yangi imtihon`
2. **Sarlavha:** `B1 Level Test`
3. **O'tish chegarasi (%):** 70 (70%+ → o'tdi)
4. **Savollar qo'shish:** har biri uchun variant va to'g'ri javob belgilanadi
5. `Nashr qilish`

**Imtihonni darsga ulash:**
- Dars sozlamalarida → `Imtihon ulash` dropdown'i

---

### 💰 To'lovlar (`/superadmin/payments`)

**Vazifa:** Barcha tenantlarning oylik to'lovlarini ko'rish.

- Tenant bo'yicha filter
- To'lov qilingan / qilinmagan holati
- Muddati o'tgan to'lovlar belgilanadi

---

### 🚫 Bloklangan o'quvchilar (`/superadmin/blocked-students`)

Barcha tenantlardagi bloklangan o'quvchilar ro'yxati.

**Blok sabablari:**
- `blocked_warning` — 3 ta ogohlantirish
- `blocked_payment` — to'lov qilinmagan

**Razbloklovka:** O'quvchi kartasidagi `Blokni ochish` tugmasi → sabab kiriting.

---

### 🌐 Landing CMS (`/superadmin/landing`)

**Vazifa:** `alochi.com` (public landing) sahifasining barcha matnlarini boshqarish.

**Bo'limlar:**

| Bo'lim | Nima tahrir qilinadi |
|---|---|
| **Hero** | Asosiy sarlavha, tavsif, CTA tugmasi matni, badge |
| **Aloqa** | Telefon, email, manzil, Telegram havolalar |
| **Sertifikat** | Sertifikat bo'limi sarlavhasi va tavsifi |
| **Mukofotlar** | Har bir mukofot kartochkasi: nomi, tavsifi, dars soni, ikonka |
| **Sayohat homiylari** | Homiy kartochkalari: nomi, shahar, emoji |

**Yangi mukofot qo'shish:**
1. `Mukofotlar` bo'limida → `+ Yangi mukofot qo'shish`
2. Nomi: `Gold Prize`
3. Tavsifi: `500 darsni tugatganlar uchun`
4. Dars soni: `500`
5. Ikonka (emoji): `🏆`
6. Tartib raqami: `3`
7. `Qo'shish`

**Homiy qo'shish:**
1. `Sayohat homiylari` → `+ Yangi homiy`
2. Nomi, shahar, emoji, tartib

> Saqlangandan keyin 60 soniyada public saytda aks etadi.

---

### 🎨 Sertifikat dizayni (`/superadmin/certificate-design`)

O'quvchilarga beriladigan sertifikatning ko'rinishini sozlash:
- Logotip, rang sxemasi
- Matn shablonlari (o'quvchi ismi avtomatik qo'yiladi)
- QR kod pozitsiyasi

---

### 📊 Analytics (`/superadmin/analytics`)

Barcha tenantlar bo'yicha umumiy statistika:
- O'quvchilar faolligi
- Dars tugatish nisbati
- Churn (tashlab ketish) ko'rsatkichlari
- AI foydalanish statistikasi

---

### 🎯 Adaptiv o'rganish (`/superadmin/adaptive`)

N-back algoritmini sozlash:
- Qiyinlik oshish sur'ati
- Eng kam/ko'p takrorlash soni
- Tenant bo'yicha alohida sozlamalar

---

### 🔄 Churn monitoring (`/superadmin/churn`)

Tashlab ketish xavfi yuqori o'quvchilar:
- ML model asosida hisoblangan risk score
- Oxirgi 7/14/30 kun faolligi
- Mentor/manager uchun tavsiyalar

---

### 📞 Murojaat so'rovlar (`/superadmin/contact-requests`)

Landing sahifadagi "Demo so'rash" formasi orqali kelgan so'rovlar:
- `new` — yangi, ko'rilmagan
- `contacted` — bog'lanilgan
- `demo_scheduled` — demo rejalashtirilgan
- `converted` — to'lovchi mijozga aylangan
- `declined` — rad etilgan

**Har bir so'rov:**
1. Bosing → to'liq ma'lumot
2. Holat o'zgartiring
3. Izoh qo'shing

---

### 🏆 Turnirlar (`/superadmin/tournaments`)

Markazlar o'rtasida musobaqa yaratish:
1. `+ Yangi turnir`
2. Boshlanish/tugash sanasi
3. Ishtirokchilar (tenantlar)
4. Natijalar ko'rinishi: `Bracket` tugmasi

---

### 🔑 Kalit so'zlar (`/superadmin/keywords`)

Darslar uchun kalit so'zlar bazasi. AI tutor shu so'zlardan foydalanadi.

---

### 📹 Video qo'llanmalar (`/superadmin/video-guides`)

Mentorlar va xodimlar uchun o'quv videolar:
- `+ Qo'shish` → YouTube URL + sarlavha
- Barcha rollarga ko'rinadi

---

### 📋 Shablonlar (`/superadmin/templates`)

Telegram xabarnomalar uchun matn shablonlari:
- Ota-onaga hisobot shablon
- Ogohlantirish xabari shablon
- Sertifikat tabrik shablon

---

### 🎭 Face SLA (`/superadmin/face-sla`)

Yuz aniqlash tiziminin samaradorlik ko'rsatkichlari:
- Muvaffaqiyatli/muvaffaqiyatsiz yuz aniqlash nisbati
- Tenant bo'yicha

---

### ✅ Mazmun sifati (`/superadmin/content-quality`)

O'quvchilarning dars bo'yicha fikr-mulohazalari (feedback):
- Har dars uchun: 😕 Qiyin / 😐 O'rtacha / 😊 Tushunarli nisbati
- Past baholi darslarni ko'rish → darsni yaxshilash uchun signal

---

### ⚙️ Sozlamalar (`/superadmin/settings`)

Tizim darajasidagi global sozlamalar:
- Platforma nomi
- Default sertifikat shabloni
- AI sozlamalari

---

## Superadmin kunlik vazifalar ro'yxati

**Har kuni (5 daqiqa):**
- [ ] Yangi demo so'rovlarni ko'rish (`/superadmin/contact-requests`)
- [ ] Tizim sog'lig'i bosh sahifada yashil ekanligini tekshirish

**Har hafta:**
- [ ] Churn ko'rsatkichlarini ko'rish (`/superadmin/churn`)
- [ ] Mazmun sifati feedbackini ko'rish (`/superadmin/content-quality`)
- [ ] Yangi dars komponentlarini qo'shish/yaxshilash
      
**Yangi tenant kelganda:**
- [ ] Tenant yaratish (`/superadmin/tenants`)
- [ ] Filadmin yaratish (`/superadmin/users`)
- [ ] Filadminga login/parol berish
