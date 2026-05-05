# Phase 6b — i18n To'liq Migratsiya Dizayni

**Sana:** 2026-05-05
**Muallif:** Davlatbek + Claude
**Holat:** Tasdiqlangan ✅

---

## Maqsad

Adouptivo platformasini to'liq ko'p tillilikka o'tkazish:
- **O'zbek (uz)** — default, prefikssiz URL
- **Ingliz (en)** — `/en/` prefiksi
- **Rus (ru)** — `/ru/` prefiksi

Qamrov: barcha sahifalar (marketing, dashboard, login), barcha UI matnlar, backend xato xabarlari.

---

## Yondashuv: Qatlamli Migratsiya (3 qadam)

### Qadam 1 — `[locale]` Folder Strukturasi

**Hozirgi holat:**
```
app/
├── (marketing)/page.tsx
├── (dashboard)/student/...
├── (auth)/login/...
└── layout.tsx
```

**Yangi holat:**
```
app/
├── [locale]/
│   ├── layout.tsx              ← NextIntlClientProvider
│   ├── (marketing)/page.tsx
│   ├── (dashboard)/student/...
│   └── (auth)/login/...
└── layout.tsx                  ← faqat <html lang={locale}><body>
```

**`[locale]/layout.tsx`:**
```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

**`next.config.ts` o'zgarishi:**
`withNextIntl` plugin qayta yoqiladi (hozir izohlangan).

**Routing qoidalari:**
- `uz` → prefikssiz: `adouptivo.com/student`
- `en` → `/en/student`
- `ru` → `/ru/student`
- `localePrefix: 'as-needed'` (routing.ts allaqachon sozlangan)
- Middleware `Accept-Language` header'ni o'qib redirect qiladi

**Internal Link'lar:**
Barcha `import Link from 'next/link'` → `import { Link } from '@/i18n/navigation'` ga almashtiriladi (allaqachon `apps/web/i18n/navigation.ts` bor).

**Qo'shimcha:**
`generateStaticParams` har bir `[locale]/...` sahifasiga qo'shiladi:
```ts
export function generateStaticParams() {
  return [{ locale: 'uz' }, { locale: 'en' }, { locale: 'ru' }];
}
```

---

### Qadam 2 — String Extraction

**Message fayl strukturasi (`messages/uz.json`):**

```json
{
  "common": {
    "save": "Saqlash",
    "cancel": "Bekor qilish",
    "loading": "Yuklanmoqda...",
    "error": "Xatolik",
    "success": "Muvaffaqiyatli saqlandi",
    "delete": "O'chirish",
    "back": "Orqaga",
    "add": "Qo'shish",
    "edit": "Tahrirlash",
    "search": "Qidirish",
    "filter": "Filter",
    "close": "Yopish",
    "confirm": "Tasdiqlash",
    "yes": "Ha",
    "no": "Yo'q",
    "next": "Keyingi",
    "prev": "Oldingi",
    "submit": "Yuborish",
    "required": "Majburiy maydon"
  },
  "nav": {
    "home": "Bosh sahifa",
    "lessons": "Darslar",
    "profile": "Profil",
    "logout": "Chiqish",
    "settings": "Sozlamalar"
  },
  "auth": {
    "login_title": "Xush kelibsiz",
    "login_subtitle": "Akkauntingizga kiring",
    "username": "Login",
    "password": "Parol",
    "submit": "Kirish",
    "logout": "Chiqish"
  },
  "marketing": {
    "hero": {
      "badge": "O'zbekiston ta'lim platformasi",
      "title": "Bolangizning muvaffaqiyat yo'li shu yerdan boshlanadi.",
      "cta_primary": "Bepul boshlash",
      "cta_secondary": "Demo so'rash"
    },
    "register": {
      "title": "Markazingizni ro'yxatdan o'tkazing",
      "step1": "Markaz",
      "step2": "Admin",
      "step3": "Tasdiqlash",
      "trial_note": "14 kun bepul sinov",
      "submit": "Ro'yxatdan o'tish"
    }
  },
  "student": {
    "dashboard": {
      "title": "Bosh sahifa",
      "streak": "Streak",
      "lessons_done": "Tugatilgan darslar",
      "continue": "Davom etish",
      "today_active": "Bugun faol!",
      "today_inactive": "Bugun faolsiz"
    },
    "lessons": {
      "title": "Yo'l xaritasi",
      "start": "Boshlash",
      "locked": "Qulflangan",
      "completed": "Tugatildi",
      "not_found": "Darslar topilmadi"
    },
    "profile": {
      "title": "Profil",
      "edit": "Tahrirlash",
      "telegram": "Ota-ona Telegram",
      "birth_date": "Tug'ilgan sana",
      "logout": "Profildan chiqish"
    },
    "exam": {
      "start": "Imtihonni boshlash",
      "submit": "Javoblarni yuborish",
      "passed": "O'tdingiz!",
      "failed": "Qayta urinib ko'ring"
    }
  },
  "mentor": {
    "group": {
      "title": "Guruh",
      "status_green": "Yaxshi",
      "status_yellow": "Diqqat",
      "status_red": "E'tibor",
      "set_status": "Status qo'yish"
    },
    "attendance": {
      "title": "Davomat",
      "present": "Keldi",
      "absent": "Kelmadi"
    }
  },
  "manager": {
    "dashboard": {
      "red_students": "Qizil o'quvchilar",
      "yellow_students": "Sariq o'quvchilar",
      "kpi": "KPI"
    },
    "sessions": {
      "title": "Sessiyalar",
      "new": "Yangi sessiya",
      "complete": "Yakunlash"
    }
  },
  "filadmin": {
    "dashboard": { "title": "Markaz boshqaruvi" },
    "students": { "title": "O'quvchilar", "add": "Yangi o'quvchi" },
    "staff": { "title": "Xodimlar", "add": "Yangi xodim" },
    "payments": { "title": "To'lovlar", "paid": "To'langan", "overdue": "Muddati o'tgan" },
    "billing": { "title": "Obuna", "plan": "Tarif", "status": "Holat" }
  },
  "superadmin": {
    "dashboard": { "title": "Superadmin paneli" },
    "tenants": { "title": "Markazlar", "add": "Yangi markaz" },
    "lessons": { "title": "Darslar", "add": "Yangi dars", "publish": "Nashr qilish" },
    "users": { "title": "Foydalanuvchilar", "add": "Yangi foydalanuvchi" }
  },
  "errors": {
    "generic": "Xatolik yuz berdi",
    "network": "Internet bilan muammo",
    "unauthorized": "Kirish taqiqlangan",
    "not_found": "Topilmadi",
    "retry": "Qayta urinish"
  }
}
```

`messages/en.json` va `messages/ru.json` — xuddi shu kalitlar, boshqa til.

**Komponentlarda ishlatish:**
```tsx
// Client komponent
'use client';
import { useTranslations } from 'next-intl';

export function SaveButton() {
  const t = useTranslations('common');
  return <button>{t('save')}</button>;
}

// Server komponent
import { getTranslations } from 'next-intl/server';

export default async function LessonsPage() {
  const t = await getTranslations('student.lessons');
  return <h1>{t('title')}</h1>;
}
```

**Ishlash tartibi:**
1. `common` + `auth` — global, birinchi
2. `marketing` + `/register` + `/privacy` + `/terms`
3. `student/*` — eng ko'p foydalanuvchi
4. `mentor/*` + `manager/*`
5. `filadmin/*` + `tester/*`
6. `superadmin/*`

---

### Qadam 3 — Backend i18n

**`apps/api/src/i18n/errors.ts`** — markazlashgan xato xabarlar:

```typescript
export const API_ERRORS = {
  login_failed:       { uz: "Login yoki parol noto'g'ri", en: "Invalid credentials", ru: "Неверный логин или пароль" },
  blocked_warning:    { uz: "Profil bloklangan (ogohlantirishlar)", en: "Account blocked (warnings)", ru: "Аккаунт заблокирован" },
  blocked_payment:    { uz: "To'lov amalga oshirilmagan", en: "Payment overdue", ru: "Задолженность по оплате" },
  token_invalid:      { uz: "Token yaroqsiz", en: "Token invalid", ru: "Токен недействителен" },
  tenant_not_found:   { uz: "Tenant topilmadi", en: "Organization not found", ru: "Организация не найдена" },
  lesson_not_found:   { uz: "Dars topilmadi", en: "Lesson not found", ru: "Урок не найден" },
  user_not_found:     { uz: "Foydalanuvchi topilmadi", en: "User not found", ru: "Пользователь не найден" },
  order_conflict:     { uz: "Tartib raqami band", en: "Order number taken", ru: "Порядковый номер занят" },
  no_questions:       { uz: "Savollar mavjud emas", en: "No questions found", ru: "Вопросы не найдены" },
  // ~50 ta...
} as const;

export type ErrorKey = keyof typeof API_ERRORS;
```

**`apps/api/src/i18n/i18n.service.ts`:**
```typescript
@Injectable()
export class I18nService {
  translate(key: ErrorKey, locale = 'uz'): string {
    const entry = API_ERRORS[key];
    if (!entry) return key;
    return entry[locale as 'uz' | 'en' | 'ru'] ?? entry.uz;
  }
}
```

**`LocaleMiddleware`** — har so'rovda `req.locale` set qiladi:
```typescript
// Accept-Language: en-US,en;q=0.9  →  'en'
// Accept-Language: ru               →  'ru'
// yo'q yoki noma'lum               →  'uz'
```

**Servislar o'zgarishi:**
```typescript
// Oldin
throw new BadRequestException("Login yoki parol noto'g'ri");

// Keyin
throw new BadRequestException(this.i18n.translate('login_failed', req.locale));
```

**Tenant default locale:**
`Tenant` modeliga `defaultLocale String @default("uz")` qo'shiladi.
`Accept-Language` yo'q bo'lsa → tenant'ning `defaultLocale` ishlatiladi.

---

## Texnik Talablar

| Talab | Yechim |
|---|---|
| `generateStaticParams` | Har bir `[locale]` sahifasiga |
| `hreflang` SEO | `<head>` da alternates |
| `LanguageSwitcher` | Allaqachon mavjud (`components/LanguageSwitcher.tsx`) |
| Brauzer tili → redirect | Middleware (allaqachon ishlaydi) |
| Sahifalar soni | ~90 ta sahifa migratsiya |
| String soni | ~400+ unique key |
| Backend xato soni | ~50 ta xato kodi |

---

## Quality Gates (har qadam uchun)

```bash
pnpm --filter web exec tsc --noEmit     # 0 error
pnpm --filter api exec tsc --noEmit     # 0 error
pnpm --filter api exec jest             # 411/411 pass
pnpm run build                          # build clean
```

---

## Risklari

| Risk | Yumshatish |
|---|---|
| `[locale]` ga ko'chirish URL'larni buzishi | `permanentRedirect` qo'shiladi `/` → locale-prefixed |
| `useTranslations` server/client aralashishi | Server: `getTranslations`, Client: `useTranslations` |
| Backend service'larni qayta yozish | `I18nService` inject qilish — minimal o'zgarish |
| Missing translation key | `next-intl` fallback uz'ga |
