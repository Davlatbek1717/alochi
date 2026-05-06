# A'lochi — Rol Qo'llanmalari

Har bir rol uchun to'liq foydalanish qo'llanmalari.

## Qo'llanmalar ro'yxati

| Fayl | Rol | Asosiy vazifasi |
|---|---|---|
| [01-superadmin.md](01-superadmin.md) | 🟣 **Superadmin** | Platforma egasi — markazlar, darslar, tizim |
| [02-filadmin.md](02-filadmin.md) | 🟠 **Filadmin** | Markaz direktori — xodimlar, to'lovlar, filiallar |
| [03-manager.md](03-manager.md) | 🟢 **Manager** | Qizil/sariq o'quvchilar, KPI, 1:1 sessiyalar |
| [04-mentor.md](04-mentor.md) | 🔵 **Mentor** | Guruh nazorati, status, imtihon ruxsati |
| [05-tester.md](05-tester.md) | 🟪 **Tester** | Imtihon navbati, texnik yordam |
| [06-student.md](06-student.md) | 🟡 **O'quvchi** | Dars o'qish, imtihon, duel, sertifikat |

## Tezkor eslatma — Kim nima qila oladi

```
SUPERADMIN
  ├── Tenant yaratish/boshqarish
  ├── Barcha rollarda foydalanuvchi yaratish
  ├── Darslar yaratish va nashr qilish
  ├── Landing CMS boshqarish
  └── Barcha statistika va analytics

FILADMIN
  ├── O'z markazida xodim qo'shish
  ├── O'quvchi qo'shish/boshqarish
  ├── To'lovlar va bloklash
  ├── Ogohlantirishlar
  └── KPI monitoring

MANAGER
  ├── Qizil/sariq o'quvchilar bilan ishlash
  ├── 1:1 sessiyalar (+5 KPI har birida)
  ├── Status o'zgartirish → KPI ball olish
  └── Mukofotlar berish

MENTOR
  ├── Guruh o'quvchilari ko'rish
  ├── Shaxsiy rivojlanish statusini belgilash
  ├── Imtihon ruxsati berish
  └── AI xato tahlilini ko'rish

TESTER
  ├── Imtihon navbati boshqarish
  ├── Texnik muammolar hal qilish
  └── Davomat belgilash

STUDENT
  ├── Dars o'qish (AI tutor bilan)
  ├── Imtihon topshirish
  ├── Duel va turnirlar
  ├── Sertifikat olish
  └── Harflar kolleksiyasi
```

## Holat tizimi (yashil/sariq/qizil)

| Holat | Kim belgilaydi | Nima uchun |
|---|---|---|
| 🟢🟡🔴 Ingliz tili | AI (avtomatik) | Dars natijalari bo'yicha |
| 🟢🟡🔴 Shaxsiy rivojlanish | **Mentor** | Kunlik kuzatuv bo'yicha |
| 🟢🟡🔴 Tanqidiy fikrlash | **Manager** yoki avtomatik | Shaxsiy yashil bo'lsa — avtomatik |

> **Avtomatik qoida:** Mentor shaxsiy holatni yashil qilsa — tanqidiy fikrlash ham avtomatik yashilga o'tadi va manager bildirishnoma oladi.

## Muhim sonlar

- **3** — ogohlantirish soni bloklash uchun
- **10** — duel uchun kerakli minimum MCQ savol soni
- **50** — birinchi sertifikat uchun dars soni
- **70%** — imtihondan o'tish chegarasi (foiz)
- **60** — Landing CMS o'zgarishi public saytda aks etish vaqti (sekund)
