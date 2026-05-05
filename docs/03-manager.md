# Manager — To'liq Qo'llanma

> **Rol:** O'quv jarayoni nazoratchi. Qizil va sariq o'quvchilar bilan
> ishlash, KPI to'plash, sertifikat berish.
> **Login sahifasi:** `/login`

---

## Manager nima qila oladi?

- ✅ Qizil va sariq o'quvchilarni ko'rish va ular bilan ishlash
- ✅ 1:1 sessiya o'tkazish va yozib qo'yish
- ✅ O'quvchi mukofotlarini berish
- ✅ O'quvchi statusini o'zgartirish (tanqidiy fikrlash holati)
- ✅ KPI ballarini to'plash
- ✅ To'lov holati eslatmalari
- ✅ Sertifikatlar berish
- ✅ Vazifalar ko'rish

---

## Bo'limlar va ulardan foydalanish

---

### 🏠 Bosh sahifa (`/manager`)

**Nima ko'rsatiladi:**
- 🔴 **Qizil o'quvchilar** — darhol e'tibor kerak
- 🟡 **Sariq o'quvchilar** — kuzatuvda
- 📊 Bugungi KPI ballar
- 📅 Bugun o'tkazilishi kerak bo'lgan sessiyalar

> 🎯 **Diqqat:** Qizil o'quvchi → 24 soat ichida ularga yetib borishga harakat qiling.

---

### 👥 O'quvchilar (`/manager/students`)

Filial bo'yicha barcha o'quvchilar:

**Ko'rsatkichlar:**
- 🟢 Yashil — yaxshi ketmoqda
- 🟡 Sariq — e'tibor kerak
- 🔴 Qizil — darhol aralashish kerak
- ⚪ Holati yo'q — hali status qo'yilmagan

**O'quvchi kartasi:**
- Ism, guruh, oxirgi faollik
- Dars progress
- Holat tarixini ko'rish

**Status o'zgartirish (tanqidiy fikrlash):**
1. O'quvchi kartasini oching
2. `Tanqidiy holat` bo'limida rang tanlang
3. Izoh kiriting (ixtiyoriy)
4. `Saqlash`

> 💡 **Eslatma:** Qizil → sariq qilsangiz **+10 KPI**, sariq → yashil **+15 KPI** olasiz.

---

### 📅 Sessiyalar (`/manager/sessions`)

1:1 sessiya — manager va o'quvchi o'rtasidagi shaxsiy uchrashuv.

**Yangi sessiya yaratish:**
1. `+ Yangi sessiya`
2. O'quvchini tanlang
3. **Sana va vaqt**
4. **Maqsad:** Nima haqida gaplashiladi
5. `Saqlash`

**Sessiya o'tkazgandan keyin:**
1. Sessiyani oching → `Yakunlash`
2. **Natija izoh:** Qisqacha nima gaplashildi
3. **Keyingi qadam:** O'quvchi nima qilishi kerak
4. `Tasdiqlash` → **+5 KPI** ball

> 📌 **Sessiya tiplari:**
> - `Motivatsiya` — o'quvchi ruhi tushkun
> - `Akademik` — darsda qiynalayapti
> - `Xulq` — tartib muammolari
> - `Ota-ona` — ota-ona bilan uchrashish

---

### 🏆 Mukofotlar (`/manager/rewards`)

O'quvchilarni rag'batlantirish uchun:

**Mukofot berish:**
1. O'quvchini tanlang
2. `+ Mukofot berish`
3. Tur: `Mini Prize` / `Silver Prize` / `Gold Prize`
4. Izoh (nima uchun)
5. `Tasdiqlash`

**Mukofot tarixi:**
- Kim qachon qanday mukofot oldi

---

### 📈 KPI (`/manager/kpi`)

O'zingizning KPI ko'rsatkichlaringiz:

| Harakat | Ball |
|---|---|
| Qizil o'quvchini sariqqa o'tkazish | +10 |
| Sariq o'quvchini yashilga o'tkazish | +15 |
| 1:1 sessiya o'tkazish | +5 |

**Ko'rsatkichlar:**
- Joriy oy jami
- Oylik dinamika grafigi
- Eng yaxshi ko'rsatkich oy

---

### 🎓 Sertifikatlar (`/manager/certificates`)

Manager sertifikat bera olmaydi, lekin **ko'rishi** mumkin:
- Barcha o'quvchilarning sertifikatlari
- Sertifikat sanasi, darajasi
- Ota-onaga yuborildi/yuborilmadi holati

---

### 💰 To'lovlar (`/manager/payments`)

To'lov holati ko'rinishi (faqat ko'rish, o'zgartirish imkoni yo'q):
- Kim to'lagan, kim to'lamagan
- Muddati o'tganlarni filadminga xabar berish

---

### ✅ Vazifalar (`/manager/tasks`)

Superadmin yoki filadmin tomonidan berilgan vazifalar:
- Ko'rish
- Bajarish
- Izoh qo'shish

---

## Manager kunlik vazifalar

**Har kuni (15-20 daqiqa):**
- [ ] Bosh sahifada qizil o'quvchilarni ko'rish
- [ ] Qizil o'quvchi bor bo'lsa — telefon qilish yoki xabar yozish
- [ ] Bugungi sessiyalarni o'tkazish va yozib qo'yish

**Har hafta:**
- [ ] Sariq ro'yxatni ko'rib chiqish
- [ ] KPI ballarni tekshirish — oylik maqsadga ketmoqdami?
- [ ] Yaxshi natija ko'rsatgan o'quvchiga mukofot berish

**Oyda bir:**
- [ ] Filadmin bilan KPI natijalarini muhokama qilish
- [ ] O'z sessiya samaradorligini baholash (nechta sessiya → nechta qizil sariqqa o'tdi)

---

## Muvaffaqiyat formulasi

```
Ko'proq sessiya → Ko'proq qizil sariqqa o'tadi → Ko'proq KPI
Ko'proq yashil → Markaz reputatsiyasi oshadi → Ko'proq o'quvchi
```
