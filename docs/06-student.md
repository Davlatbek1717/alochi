# O'quvchi (Student) — To'liq Qo'llanma

> **Rol:** Asosiy foydalanuvchi — dars o'qish, imtihon topshirish,
> do'stlar bilan musobaqa.
> **Login sahifasi:** `/login` yoki markaz URL'i

---

## O'quvchi nima qila oladi?

- ✅ Darslarni ko'rish va o'qish
- ✅ AI tutor bilan suhbat
- ✅ Imtihon topshirish
- ✅ Sertifikat olish
- ✅ Do'stlar bilan duel o'ynash
- ✅ Harflar kolleksiyasi to'plash
- ✅ Reytingda ko'rish
- ✅ Profil tahrirlash
- ✅ Ota-onani Telegram bilan ulash

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/student`)

**Nima ko'rsatiladi:**

**1. Holat kartasi (Sizning holatingiz)**
- 🟢 **Ingliz tili** — so'nggi dars natijalari (AI tomonidan)
- 🟢 **Shaxsiy rivojlanish** — mentor tomonidan belgilangan
- 🟢 **Tanqidiy fikrlash** — avtomatik (shaxsiy yashil bo'lsa — bu ham yashil)

**2. Davom etish kartasi**
- Keyingi darsga o'tish tugmasi
- Qancha dars qolgan ko'rsatiladi

**3. Streak (Ketma-ket kunlar)**
- 🔥 7 — 7 kun ketma-ket o'qildi
- 🛡️ Shield — bir kun o'tkazib yuborishdan himoya

**4. Kunlik takrorlash**
- Ilgari o'tilgan so'zlar — esda qoldirish uchun

**5. Ogohlantirishlar**
- Mentor yoki manager xabarlari

---

### 📚 Yo'l xaritasi (`/student/lessons`)

Bu — eng muhim sahifa. Barcha darslar zigzag yo'lda ko'rsatiladi.

**Dars holatlari:**
- ✅ **Yashil** — bajarilgan
- 🔵 **Ko'k (joriy)** — shu darsda turibsiz
- 🔒 **Kulrang** — hali qulflangan

**Darsni boshlash:**
1. Ko'k darsni bosing
2. Pastdan `Boshlash` tugmasi
3. Dars komponentlari ketma-ket chiqadi

**Sidebar (chap/o'ng):**
- Jami progress foizi
- Streak va bugungi faollik

---

### 📖 Dars o'tish

Dars bir nechta qismdan iborat:

#### 1. So'z lug'ati (Vocabulary)
- Yangi so'zlar kartochka shaklida
- ➡️ Ko'rsatish
- So'z + tarjima + misol jumla

#### 2. Flash kartochkalar
- Ingliz so'zi ko'rsatiladi → O'zbek tarjimasini eslang
- ✅ Bilaman / ❌ Bilmayman

#### 3. Talaffuz mashqi (Speak Sentence)
- Gapni o'qib bering (mikrofon kerak)
- AI talaffuzingizni baholaydi
- Ball: 0-100

#### 4. Test savollar (MCQ)
- 4 ta variant — to'g'risini tanlang
- Xato qilsangiz → to'g'ri javob ko'rsatiladi

#### 5. Bo'sh joy to'ldirish
- Gapda bo'sh joyni to'g'ri so'z bilan to'ldiring

#### 6. Juftlash (Match Pairs)
- Chap tomonda so'zlar, o'ng tomonda tarjimalar
- To'g'ri juftlarni ulang

#### AI Tutor suhbat
- Har bir dars komponentida savol bersangiz bo'ladi
- Mikrofon belgisiga bosing (ovozli) yoki yozing
- AI o'zbek tilida tushuntiradi

---

### 🎓 Imtihon

Mentor sizga imtihon ruxsati bergandan keyin faol bo'ladi.

**Imtihon qadamlari:**
1. Bosh sahifada `Imtihon` xabarnomasi chiqadi
2. `Boshlash` tugmasi → Tester ekranda ko'radi
3. 10 ta savol ketma-ket
4. Vaqt chegarasi bor (har savol uchun)
5. Natija darhol ko'rsatiladi
6. **70%+** → O'tdi ✅ | **70%-** → Qayta urinish kerak

---

### 🤺 Duel (`/student/duels`)

Do'stingiz bilan bilim bellashuvi!

**Duel shartlari:**
- Siz va do'stingiz **bitta darsni** ikkalingiz ham tugatgan bo'lishingiz kerak
- O'sha darsda kamida **10 ta savol** bo'lishi kerak

**Duel qadamlari:**
1. `/student/duels` → `+ Yangi duel`
2. Do'stingizni tanlang
3. `Chaqirish` — do'stingiz xabarnoma oladi
4. Do'stingiz qabul qilsa → 10 ta savol
5. Kim tezroq va ko'proq to'g'ri javob bersa — **g'alaba** 🏆

---

### 👫 Do'stlar (`/student/friends`)

- Do'stlar ro'yxati
- Yangi do'st qo'shish
- Duel chaqirish

---

### 🏆 Reyting (`/student/leaderboard`)

Markaz ichidagi reyting:
- Eng ko'p dars tugatganlar
- Eng uzun streak
- O'zingiz nechanchi o'rindasiz

---

### 🎖️ Sertifikatlar (`/student/certificates`)

Har 50 ta dars tugatganingizda sertifikat olasiz:
- **Bronza** — 50 dars
- **Kumush** — 150 dars
- **Oltin** — 300 dars
- **Platina** — 500 dars

**Sertifikat nima ichida:**
- Ismingiz
- Sana
- QR kod (tekshirish uchun)
- Ota-onangizga Telegram orqali yuboriladi

---

### 🔤 Harflar kolleksiyasi (`/student/letters`)

O'zbek alifbosining 36 ta harfi:
- Har dars tugatganda — tasodifiy harf ochiladi
- Barcha 36 ta harf to'planganda — maxsus mukofot 🎁

---

### 🧠 Xatolarni ko'rish (`/student/errors`)

- Imtihon va darsda qilgan xatolaringiz
- AI tushuntirishi: nima uchun xato qildingiz
- Qayta o'rganish uchun tavsiya

---

### 📰 Lenta (`/student/lenta`)

Do'stlar faoliyati:
- Kim qaysi darsni tugatdi
- Kim sertifikat oldi
- Duel natijalari

---

### 📝 Takrorlash (`/student/review`)

**Spaced Repetition** — ilmiy eslatish tizimi:
- Bugun qayta o'rganish kerak bo'lgan so'zlar
- Ebbinghaus krivisiga ko'ra hisoblanadi
- 5-10 daqiqa sarf qiling → so'zlar yodda qoladi

---

### 🏆 Turnirlar (`/student/tournaments`)

Markaz yoki platforma turnirlariga qatnashish:
- Turnir savollari
- Reyting
- Sovrin

---

### 👤 Profil (`/student/profile`)

**Ko'rinadigan ma'lumotlar:**
- Ism, login
- Liga va KPI darajasi
- Streak, tugatilgan darslar, sertifikatlar

**Tahrirlash mumkin:**
1. `Tahrirlash` tugmasi
2. **Ota-ona Telegram ID** — bot bilan ulash uchun
3. **Tug'ilgan sana**
4. `Saqlash`

**Ota-onani ulash:**
1. Profil sahifasida `Ota-onangizni Telegram orqali ulang` havolasini bosing
2. Telegram'da bot ochilib `Start` bosing
3. Muvaffaqiyatli ulanganidan keyin ota-ona har kuni hisobot oladi

**Sozlamalar:**
- 🔊 Ovoz effektlari yoq/o'chiq
- 🎤 Brauzer ovozi (Web Speech) yoq/o'chiq

**Chiqish:**
- `Profildan chiqish` → `Chiqish` (tasdiqlash kerak)

---

### 🆔 Yuz ID (`/profile/enroll`)

Face ID — kamera orqali avtomatik davomat uchun:

1. `/profile/enroll` sahifasiga o'ting
2. `Boshlash` → kamera yoqiladi
3. Yuzingizni to'g'riga tutib turing
4. 5 ta rasm olinadi (avtomatik)
5. `Saqlash`

Keyinchalik darsga kirganda kamera yuzingizni taniydi → davomat avtomatik.

---

## O'quvchi uchun muhim qoidalar

| Qoida | Sababi |
|---|---|
| Har kuni kirib dars qiling | Streak uzilmasin |
| Imtihon oldidan darsni tugatib oling | Imtihon shu darsning savollaridan |
| Duel uchun do'st qo'shing | Qiziqarli va motivatsion |
| Ota-onani ulang | Ular xabardor bo'lishi kerak |
| Talaffuz mashqida mikrofonni yoqing | AI to'g'ri baholash uchun |

---

## O'quvchi kunlik oqim

```
Ertalab         → Bosh sahifada streak tekshiring
                → Bugungi takrorlash savollarini yoching (5 daqiqa)

Markaz vaqti    → Yo'l xaritasidan joriy darsni oching
                → Ketma-ket komponentlarni yoching
                → Qiyin savollarda AI tutoriga so'rang
                → Darsni tugating → sertifikat bormi?

Kechqurun       → Lentada do'stlar faoliyatini ko'ring
                → Duel chaqiring (qiziqarli!)
```
