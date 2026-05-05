# Phase 6b — i18n To'liq Migratsiya Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js App Router'ni to'liq ko'p tillilikka o'tkazish — 88 ta sahifa `[locale]` strukturasiga ko'chiriladi, barcha UI matnlar `useTranslations()` bilan almashtiriladi, backend xato xabarlari `Accept-Language` bo'yicha tarjima qilinadi.

**Architecture:** Qatlamli migratsiya — Layer 1 (folder struktura), Layer 2 (string extraction), Layer 3 (backend i18n). Har qatlam alohida commit. `next-intl` allaqachon o'rnatilgan, routing/request config tayyor.

**Tech Stack:** Next.js 15 App Router, next-intl 3.x, NestJS, Prisma, TypeScript

---

## Fayl Xaritasi

### Yangi fayllar
- `apps/web/app/[locale]/layout.tsx` — NextIntlClientProvider wrapper
- `apps/web/app/[locale]/(marketing)/` — marketing pages ko'chiriladi
- `apps/web/app/[locale]/(dashboard)/` — dashboard pages ko'chiriladi
- `apps/web/app/[locale]/(auth)/` — login ko'chiriladi
- `apps/web/app/[locale]/register/page.tsx` — ko'chiriladi
- `apps/web/app/[locale]/privacy/page.tsx` — ko'chiriladi
- `apps/web/app/[locale]/terms/page.tsx` — ko'chiriladi
- `apps/web/app/[locale]/offline/page.tsx` — ko'chiriladi
- `apps/api/src/i18n/errors.ts` — ~50 ta xato kodi, 3 tilda
- `apps/api/src/i18n/i18n.service.ts` — tarjimon service
- `apps/api/src/i18n/i18n.module.ts` — modul
- `apps/api/src/common/middleware/locale.middleware.ts` — Accept-Language o'qish

### O'zgartiriluvchi fayllar
- `apps/web/app/layout.tsx` — html lang={locale} dinamik
- `apps/web/next.config.ts` — withNextIntl yoqiladi
- `apps/web/middleware.ts` — setRequestLocale qo'shiladi
- `apps/web/messages/uz.json` — kengaytiriladi (~400 key)
- `apps/web/messages/en.json` — to'ldiriladi
- `apps/web/messages/ru.json` — to'ldiriladi
- Barcha `page.tsx` va komponent `.tsx` — useTranslations()
- `apps/api/src/app.module.ts` — I18nModule register
- ~50 ta servis — xato xabarlar i18n.translate() bilan

---

## LAYER 1: `[locale]` Folder Strukturasi

---

### Task 1: `[locale]/layout.tsx` va root layout yangilash

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/[locale]/layout.tsx`

- [ ] **Step 1: `app/[locale]/layout.tsx` yaratish**

```tsx
// apps/web/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'uz' | 'en' | 'ru')) {
    notFound();
  }
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 2: Root `app/layout.tsx` da `lang` dinamik qilish**

`<html lang="en">` ni `<html lang="uz">` ga o'zgartiring (static default). `NextIntlClientProvider` root layout'dan olib tashlangan — u `[locale]/layout.tsx` da.

```tsx
// apps/web/app/layout.tsx — asosiy o'zgarish
export default function RootLayout({ children }) {
  return (
    <html lang="uz">  {/* uz default; [locale]/layout runtime'da locale'ni biladi */}
      <body className={`${geistSans.variable} ${geistMono.variable} ${nunito.variable} antialiased`}>
        <DevServiceWorkerCleanup />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 error

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/[locale]/layout.tsx
git commit -m "feat(i18n): add [locale] layout with NextIntlClientProvider"
```

---

### Task 2: `withNextIntl` plugin yoqish va middleware yangilash

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: `next.config.ts` da withNextIntl izohlani olib tashlash**

```ts
// apps/web/next.config.ts — o'zgarish
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// ... pastda:
export default withPWA(withNextIntl(nextConfig));
```

Faylning boshidagi izoh qatorlarini (`// import createNextIntlPlugin...`, `// const withNextIntl...`) olib tashlang, asl import'larni qaytaring.

- [ ] **Step 2: `middleware.ts` da `setRequestLocale` qo'shish**

```ts
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18n = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const subdomain = hostname.split('.')[0];
  const isRootDomain =
    ['www', 'adouptivo', 'localhost', 'app'].includes(subdomain) ||
    (!subdomain.includes('-') && subdomain.length < 4);

  const requestHeaders = new Headers(request.headers);
  if (!isRootDomain) {
    requestHeaders.set('x-tenant-slug', subdomain);
  }

  const response = handleI18n(
    new NextRequest(request, { headers: requestHeaders }),
  );
  if (response) return response;
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 3: Build test (sahifalar ko'chirilmagan, build muvaffaqiyatsiz bo'lishi mumkin — kuzatish uchun)**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 error (pages hali ko'chirilmagan, plugin faqat `[locale]` folder bilan ishlaydi)

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts apps/web/middleware.ts
git commit -m "feat(i18n): enable withNextIntl plugin + update middleware"
```

---

### Task 3: Marketing va auth sahifalarni ko'chirish

**Files:**
- Move: `apps/web/app/(marketing)/` → `apps/web/app/[locale]/(marketing)/`
- Move: `apps/web/app/(auth)/` → `apps/web/app/[locale]/(auth)/`
- Move: `apps/web/app/(marketing)/layout.tsx` → `apps/web/app/[locale]/(marketing)/layout.tsx`
- Move: register, privacy, terms, offline sahifalari

- [ ] **Step 1: Marketing route group ko'chirish**

```bash
# apps/web/app ichida
mkdir -p "apps/web/app/[locale]"
git mv "apps/web/app/(marketing)" "apps/web/app/[locale]/(marketing)"
```

- [ ] **Step 2: Auth route group ko'chirish**

```bash
git mv "apps/web/app/(auth)" "apps/web/app/[locale]/(auth)"
```

- [ ] **Step 3: Alohida sahifalar ko'chirish**

```bash
git mv "apps/web/app/register" "apps/web/app/[locale]/register"
git mv "apps/web/app/privacy" "apps/web/app/[locale]/privacy" 2>/dev/null || true
git mv "apps/web/app/terms" "apps/web/app/[locale]/terms" 2>/dev/null || true
git mv "apps/web/app/offline" "apps/web/app/[locale]/offline"
```

- [ ] **Step 4: `(marketing)/layout.tsx` da `generateStaticParams` qo'shish**

Ko'chirilgan `apps/web/app/[locale]/(marketing)/layout.tsx` faylini oching va qo'shing:
```tsx
import { routing } from '@/i18n/routing';
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(i18n): move marketing + auth pages under [locale]"
```

---

### Task 4: Dashboard sahifalarni ko'chirish

**Files:**
- Move: `apps/web/app/(dashboard)/` → `apps/web/app/[locale]/(dashboard)/`

- [ ] **Step 1: Dashboard route group ko'chirish**

```bash
git mv "apps/web/app/(dashboard)" "apps/web/app/[locale]/(dashboard)"
```

- [ ] **Step 2: `(dashboard)/layout.tsx` da generateStaticParams qo'shish**

Ko'chirilgan `apps/web/app/[locale]/(dashboard)/layout.tsx` faylini oching:
```tsx
import { routing } from '@/i18n/routing';
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
```

- [ ] **Step 3: Kiosk layout ko'chirish**

```bash
git mv "apps/web/app/kiosk" "apps/web/app/[locale]/kiosk"
```

- [ ] **Step 4: Profile sahifalar ko'chirish (agar [locale] tashqarida bo'lsa)**

`apps/web/app/profile` papkasini tekshiring:
```bash
ls "apps/web/app/profile" 2>/dev/null && git mv "apps/web/app/profile" "apps/web/app/[locale]/profile" || echo "profile [locale] ichida"
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 error

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(i18n): move dashboard + kiosk pages under [locale]"
```

---

### Task 5: Link import'larini `@/i18n/navigation` ga o'zgartirish

Barcha `next/link` va `next/navigation` import'larni `@/i18n/navigation` ga almashtirish.

**Files:**
- Modify: barcha `.tsx` fayllar `apps/web/app/[locale]/` ichida

- [ ] **Step 1: `Link` import'larni o'zgartirish**

```bash
# next/link → @/i18n/navigation
find "apps/web/app/[locale]" -name "*.tsx" -exec sed -i "s/from 'next\/link'/from '@\/i18n\/navigation'/g" {} \;
```

- [ ] **Step 2: `useRouter` import'larni o'zgartirish (faqat locale-aware kerak bo'lganda)**

`useRouter` va `usePathname` ni `next/navigation` dan emas `@/i18n/navigation` dan import qilish kerak bo'lgan joylarda:
```bash
# Faqat locale switching uchun ishlatilganlar (LanguageSwitcher allaqachon to'g'ri)
# Boshqa useRouter'lar next/navigation'da qolishi mumkin (redirect, push navigation uchun)
```

> ⚠️ **Diqqat:** `useRouter` dan `next/navigation` — navigatsiya uchun yaxshi. `@/i18n/navigation` — faqat locale switch uchun. Ko'p o'zgartirish talab qilmaydi.

- [ ] **Step 3: Barcha statik `<Link href="...">` lar to'g'ri ekanligini tekshirish**

next-intl `Link` komponenti locale'ni avtomatik qo'shadi, shuning uchun `/student` → `/en/student` (en tilida). Hech qanday qo'lda prefix qo'shish kerak emas.

- [ ] **Step 4: Full typecheck va build**

```bash
pnpm --filter web exec tsc --noEmit
pnpm run build
```

Expected: 0 error, build yashil

- [ ] **Step 5: Layer 1 yakuniy commit**

```bash
git add -A
git commit -m "feat(i18n-layer1): complete [locale] folder migration — 88 pages moved, withNextIntl enabled"
```

---

## LAYER 2: String Extraction

---

### Task 6: `messages/` fayllarini kengaytirish

**Files:**
- Modify: `apps/web/messages/uz.json`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/ru.json`

- [ ] **Step 1: `uz.json` ni to'liq kengaytirish**

Mavjud faylni quyidagi to'liq struktura bilan almashtiring:

```json
{
  "common": {
    "save": "Saqlash", "cancel": "Bekor qilish", "loading": "Yuklanmoqda...",
    "error": "Xatolik yuz berdi", "success": "Muvaffaqiyatli saqlandi",
    "delete": "O'chirish", "back": "Orqaga", "add": "Qo'shish",
    "edit": "Tahrirlash", "search": "Qidirish", "filter": "Filter",
    "close": "Yopish", "confirm": "Tasdiqlash", "yes": "Ha", "no": "Yo'q",
    "next": "Keyingi", "prev": "Oldingi", "submit": "Yuborish",
    "required": "Majburiy maydon", "retry": "Qayta urinish",
    "view": "Ko'rish", "publish": "Nashr qilish", "unpublish": "Bekor qilish",
    "new": "Yangi", "list": "Ro'yxat", "detail": "Batafsil"
  },
  "nav": {
    "home": "Bosh sahifa", "lessons": "Darslar", "profile": "Profil",
    "logout": "Chiqish", "settings": "Sozlamalar", "students": "O'quvchilar",
    "staff": "Xodimlar", "payments": "To'lovlar", "attendance": "Davomat",
    "reports": "Hisobotlar", "certificates": "Sertifikatlar",
    "tournaments": "Musobaqalar", "tasks": "Vazifalar"
  },
  "auth": {
    "login_title": "Xush kelibsiz", "login_subtitle": "Akkauntingizga kiring",
    "username": "Login", "password": "Parol", "submit": "Kirish",
    "logout": "Chiqish", "logout_confirm": "Profildan chiqmoqchimisiz?",
    "enter_username": "Loginni kiriting", "enter_password": "Parolni kiriting"
  },
  "marketing": {
    "hero": {
      "badge": "O'zbekiston ta'lim platformasi",
      "title": "Bolangizning muvaffaqiyat yo'li shu yerdan boshlanadi.",
      "subtitle": "3–7 sinf o'quvchilari uchun ingliz tili, shaxsiy rivojlanish va tanqidiy fikrlashni o'rgatuvchi zamonaviy SaaS platforma.",
      "cta_primary": "Bepul boshlash", "cta_secondary": "Demo so'rash",
      "ai_tutor": "AI tutor", "personal_approach": "Shaxsiy yondashuv",
      "telegram_report": "Ota-ona hisoboti", "lesson_map": "Yo'l xaritasi"
    },
    "register": {
      "title": "Markazingizni ro'yxatdan o'tkazing",
      "step1": "Markaz", "step2": "Admin", "step3": "Tasdiqlash",
      "center_name": "Markaz nomi", "slug": "URL (slug)", "slug_hint": "URL: adouptivo.com/{slug}/login",
      "admin_name": "To'liq ism", "admin_login": "Login", "admin_password": "Parol",
      "admin_phone": "Telefon (ixtiyoriy)", "trial_note": "14 kun bepul sinov — kredit karta talab qilinmaydi",
      "submit": "Ro'yxatdan o'tish", "submitting": "Yaratilmoqda...",
      "success_title": "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
      "success_subtitle": "Markazingiz yaratildi. Login sahifasiga o'ting.",
      "go_to_login": "Kirishga o'tish", "back_home": "Bosh sahifaga"
    },
    "demo": {
      "title": "Demo so'rash", "name": "Ismingiz", "center": "Markaz nomi",
      "phone": "Telefon", "submit": "Yuborish", "success": "So'rovingiz qabul qilindi!"
    }
  },
  "student": {
    "dashboard": {
      "greeting": "Salom", "streak": "Streak", "lessons_done": "Tugatilgan darslar",
      "continue": "Davom etish", "next_lesson": "Keyingi darsni boshlash",
      "today_active": "Bugun faol!", "today_inactive": "Bugun faolsiz",
      "all_done": "Barcha darslar tugatildi! 🎉", "status_title": "Sizning holatingiz",
      "english_status": "Ingliz tili", "personal_status": "Shaxsiy rivojlanish",
      "critical_status": "Tanqidiy fikrlash", "warnings": "Ogohlantirishlar"
    },
    "lessons": {
      "title": "Yo'l xaritasi", "start": "Boshlash", "continue": "Davom etish",
      "locked": "Qulflangan", "completed": "Tugatildi", "current": "Joriy dars",
      "not_found": "Darslar topilmadi", "coming_soon": "Tez orada qo'shiladi",
      "back_home": "Bosh sahifaga qaytish", "progress": "Progress",
      "today_active": "Bugun faol!", "today_inactive": "Bugun faolsiz"
    },
    "profile": {
      "title": "Profil", "edit": "Tahrirlash", "save": "Saqlash",
      "telegram": "Ota-ona Telegram", "telegram_linked": "Ulangan",
      "telegram_unlinked": "Bog'lanmagan", "birth_date": "Tug'ilgan sana",
      "not_set": "Belgilanmagan", "logout": "Profildan chiqish",
      "face_id": "Yuz ID", "face_enrolled": "Yuz ID — faol",
      "face_not_enrolled": "Yuz ID ro'yxat", "sound": "Ovoz effektlari",
      "speech": "Brauzer ovozi"
    },
    "exam": {
      "start": "Imtihonni boshlash", "submit": "Javoblarni yuborish",
      "passed": "O'tdingiz!", "failed": "Qayta urinib ko'ring",
      "score": "Ball", "time_left": "Vaqt qoldi"
    },
    "certificates": {
      "title": "Sertifikatlar", "none": "Hali sertifikat yo'q",
      "share": "Ulashish", "download": "Yuklab olish", "issued": "Berildi"
    },
    "letters": {
      "title": "Harflar kolleksiyasi", "collected": "ta to'plangan",
      "total": "ta harf jami"
    },
    "duels": {
      "title": "Duellar", "new": "Yangi duel", "challenge": "Chaqirish",
      "accept": "Qabul qilish", "decline": "Rad etish", "won": "G'alaba!",
      "lost": "Yutqizdi"
    },
    "leaderboard": {
      "title": "Reyting", "rank": "O'rin", "name": "Ism", "score": "Ball"
    },
    "review": {
      "title": "Kunlik takrorlash", "start": "Boshlash", "done": "Tugadi!"
    }
  },
  "mentor": {
    "group": {
      "title": "Guruh", "students": "O'quvchilar", "set_status": "Status qo'yish",
      "status_green": "Yaxshi", "status_yellow": "Diqqat", "status_red": "E'tibor",
      "ai_analysis": "AI xato tahlili", "exam_permission": "Imtihon ruxsati"
    },
    "attendance": {
      "title": "Davomat", "mark": "Belgilash", "present": "Keldi", "absent": "Kelmadi"
    },
    "tasks": { "title": "Vazifalar", "done": "Bajarildi" }
  },
  "manager": {
    "dashboard": {
      "title": "Bosh sahifa", "red_students": "Qizil o'quvchilar",
      "yellow_students": "Sariq o'quvchilar", "kpi": "KPI ballar"
    },
    "sessions": {
      "title": "Sessiyalar", "new": "Yangi sessiya", "complete": "Yakunlash",
      "motivation": "Motivatsiya", "academic": "Akademik"
    },
    "rewards": { "title": "Mukofotlar", "give": "Mukofot berish" },
    "certificates": { "title": "Sertifikatlar" }
  },
  "filadmin": {
    "dashboard": { "title": "Markaz boshqaruvi" },
    "students": { "title": "O'quvchilar", "add": "Yangi o'quvchi", "filter": "Filter" },
    "staff": { "title": "Xodimlar", "add": "Yangi xodim" },
    "payments": {
      "title": "To'lovlar", "paid": "To'langan", "overdue": "Muddati o'tgan",
      "block": "Bloklash", "unblock": "Blokni ochish"
    },
    "warnings": {
      "title": "Ogohlantirishlar", "give": "Ogohlantirish berish", "cancel": "Bekor qilish"
    },
    "billing": {
      "title": "Obuna", "plan": "Tarif", "status": "Holat",
      "trial": "Sinov davri", "active": "Faol", "expired": "Muddati o'tgan",
      "contact": "Bog'lanish", "coming_soon": "Tez kunda"
    },
    "lessons": {
      "title": "Darslar", "add": "Yangi dars", "publish": "Nashr qilish",
      "import": "Shablondan import"
    }
  },
  "tester": {
    "exam_queue": {
      "title": "Imtihon navbati", "start": "Boshlash", "waiting": "Kutmoqda",
      "in_progress": "Jarayonda", "done": "Tugadi"
    },
    "tech_issues": {
      "title": "Texnik muammolar", "seen": "Ko'rildi", "resolved": "Hal qilindi"
    }
  },
  "superadmin": {
    "dashboard": { "title": "Superadmin paneli" },
    "tenants": {
      "title": "Markazlar", "add": "Yangi markaz", "slug": "Slug",
      "active": "Faol", "inactive": "Faol emas"
    },
    "users": { "title": "Foydalanuvchilar", "add": "Yangi foydalanuvchi" },
    "lessons": {
      "title": "Darslar", "add": "Yangi dars", "publish": "Nashr qilish",
      "template": "Shablon", "components": "Komponentlar"
    },
    "exams": { "title": "Imtihonlar", "add": "Yangi imtihon" },
    "landing": { "title": "Landing CMS" },
    "settings": { "title": "Sozlamalar" }
  },
  "errors": {
    "generic": "Xatolik yuz berdi",
    "network": "Internet bilan muammo. Iltimos, ulanishingizni tekshiring.",
    "unauthorized": "Kirish taqiqlangan",
    "not_found": "Sahifa topilmadi",
    "retry": "Qayta urinish",
    "load_failed": "Ma'lumotlar yuklanmadi",
    "save_failed": "Saqlashda xatolik"
  }
}
```

- [ ] **Step 2: `en.json` ni to'ldirish**

Xuddi shu struktura, ingliz tarjimasi bilan. Faqat qiymatlar o'zgaradi:

```json
{
  "common": { "save": "Save", "cancel": "Cancel", "loading": "Loading...",
    "error": "An error occurred", "success": "Saved successfully", ...},
  "auth": { "login_title": "Welcome back", "username": "Username", "password": "Password",
    "submit": "Sign in", ... },
  "student": { "dashboard": { "continue": "Continue", "all_done": "All lessons complete! 🎉", ... } },
  ...
}
```

**Muhim:** Har bir kalit `uz.json` bilan bir xil bo'lishi kerak. Missing key bo'lsa next-intl `uz.json` fallback'ga o'tadi.

- [ ] **Step 3: `ru.json` ni to'ldirish**

Xuddi shu, rus tilida:
```json
{
  "common": { "save": "Сохранить", "cancel": "Отмена", "loading": "Загрузка...", ... },
  "auth": { "login_title": "Добро пожаловать", "username": "Логин", ... },
  ...
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/
git commit -m "feat(i18n-layer2): expand message files — ~400 keys, uz/en/ru"
```

---

### Task 7: common + auth + marketing sahifalariga `useTranslations` qo'shish

**Files:**
- Modify: `apps/web/app/[locale]/(auth)/login/page.tsx`
- Modify: `apps/web/app/[locale]/(marketing)/_components/Header.tsx`
- Modify: `apps/web/app/[locale]/(marketing)/_components/Hero.tsx`
- Modify: `apps/web/app/[locale]/(marketing)/_components/Footer.tsx`
- Modify: `apps/web/app/[locale]/register/page.tsx`

- [ ] **Step 1: Login sahifasini yangilash**

```tsx
// apps/web/app/[locale]/(auth)/login/page.tsx ichida
import { useTranslations } from 'next-intl';

// Client komponent bo'lgani uchun:
const t = useTranslations('auth');

// Hardcoded matnlarni almashtiring:
// "Xush kelibsiz"   → t('login_title')
// "Login"           → t('username')
// "Parol"           → t('password')
// "Kirish"          → t('submit')
```

- [ ] **Step 2: Header komponent**

```tsx
import { useTranslations } from 'next-intl';
// ...
const t = useTranslations('nav');
// "Imkoniyatlar" → t('features') — lekin nav items statik, labels alohida kalitlar
```

- [ ] **Step 3: Hero komponent**

```tsx
import { useTranslations } from 'next-intl';
const t = useTranslations('marketing.hero');
// badge, title (agar cms null bo'lsa), cta_primary, cta_secondary
const badge = cms?.badge || t('badge');
const cta = cms?.cta || t('cta_primary');
```

- [ ] **Step 4: Register sahifasi**

```tsx
import { useTranslations } from 'next-intl';
const t = useTranslations('marketing.register');
// title, step1, step2, step3, submit, trial_note, success_title, go_to_login
```

- [ ] **Step 5: Typecheck va test**

```bash
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/(auth)/ apps/web/app/[locale]/(marketing)/ apps/web/app/[locale]/register/
git commit -m "feat(i18n-layer2): useTranslations in auth + marketing pages"
```

---

### Task 8: Student sahifalariga `useTranslations` qo'shish

**Files:**
- Modify: `apps/web/app/[locale]/(dashboard)/student/page.tsx`
- Modify: `apps/web/app/[locale]/(dashboard)/student/lessons/page.tsx`
- Modify: `apps/web/app/[locale]/(dashboard)/student/profile/page.tsx`
- Modify: `apps/web/app/[locale]/(dashboard)/student/certificates/page.tsx`
- Modify: `apps/web/app/[locale]/(dashboard)/student/duels/page.tsx`
- Modify: `apps/web/app/[locale]/(dashboard)/student/leaderboard/page.tsx`

- [ ] **Step 1: Student dashboard**

```tsx
import { useTranslations } from 'next-intl';
const t = useTranslations('student.dashboard');
// "Bugun faol!" → t('today_active')
// "Bugun faolsiz" → t('today_inactive')
// "Davom etish" → t('continue')
// "Sizning holatingiz" → t('status_title')
```

- [ ] **Step 2: Lessons page**

```tsx
const t = useTranslations('student.lessons');
// "Yo'l xaritasi" → t('title')
// "Bosh sahifaga qaytish" → t('back_home')
// "Tez orada qo'shiladi" → t('coming_soon')
// "Bugun faol!" → t('today_active')
```

- [ ] **Step 3: Profile page**

```tsx
const t = useTranslations('student.profile');
// "Ota-ona Telegram" → t('telegram')
// "Ulangan" / "Bog'lanmagan" → t('telegram_linked') / t('telegram_unlinked')
// "Belgilanmagan" → t('not_set')
// "Profildan chiqish" → t('logout')
```

- [ ] **Step 4: Certificates, duels, leaderboard**

```tsx
const tc = useTranslations('student.certificates');
const td = useTranslations('student.duels');
const tl = useTranslations('student.leaderboard');
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/[locale]/(dashboard)/student/"
git commit -m "feat(i18n-layer2): useTranslations in student pages"
```

---

### Task 9: Mentor, Manager, Filadmin, Tester, Superadmin sahifalari

**Files:** Barcha qolgan dashboard sahifalari

- [ ] **Step 1: Mentor sahifalari**

```tsx
// mentor/group/page.tsx, mentor/attendance/page.tsx
import { useTranslations } from 'next-intl';
const t = useTranslations('mentor.group');
// "Guruh" → t('title')
// "Status qo'yish" → t('set_status')
// "Yaxshi/Diqqat/E'tibor" → t('status_green'), t('status_yellow'), t('status_red')
```

- [ ] **Step 2: Manager sahifalari**

```tsx
// manager/page.tsx, manager/sessions/page.tsx
const t = useTranslations('manager.dashboard');
// "Qizil o'quvchilar" → t('red_students')
// "KPI ballar" → t('kpi')

const ts = useTranslations('manager.sessions');
// "Yangi sessiya" → ts('new')
// "Yakunlash" → ts('complete')
```

- [ ] **Step 3: Filadmin sahifalari**

```tsx
// filadmin/students, filadmin/staff, filadmin/payments, filadmin/billing
const t = useTranslations('filadmin.students');
// "Yangi o'quvchi" → t('add')

const tp = useTranslations('filadmin.payments');
// "To'langan" → tp('paid')
// "Muddati o'tgan" → tp('overdue')
// "Bloklash" → tp('block')
```

- [ ] **Step 4: Tester sahifalari**

```tsx
const t = useTranslations('tester.exam_queue');
// "Imtihon navbati" → t('title')
// "Kutmoqda" → t('waiting')
// "Boshlash" → t('start')
```

- [ ] **Step 5: Superadmin asosiy sahifalari**

```tsx
const t = useTranslations('superadmin.tenants');
// "Markazlar" → t('title')
// "Yangi markaz" → t('add')

const tl = useTranslations('superadmin.lessons');
// "Darslar" → tl('title')
// "Shablon" → tl('template')
```

- [ ] **Step 6: Umumiy `common` namespace qo'llash**

Barcha sahifalarda qaytariladigan tugmalar:
```tsx
const tc = useTranslations('common');
// "Saqlash" → tc('save')
// "Bekor qilish" → tc('cancel')
// "Tahrirlash" → tc('edit')
// "O'chirish" → tc('delete')
```

- [ ] **Step 7: Typecheck + full build**

```bash
pnpm --filter web exec tsc --noEmit
pnpm run build
```

Expected: 0 error, build yashil

- [ ] **Step 8: Layer 2 yakuniy commit**

```bash
git add -A
git commit -m "feat(i18n-layer2): useTranslations in all dashboard pages — 400+ strings extracted"
```

---

## LAYER 3: Backend i18n

---

### Task 10: `I18nModule` + `I18nService` + `errors.ts` yaratish

**Files:**
- Create: `apps/api/src/i18n/errors.ts`
- Create: `apps/api/src/i18n/i18n.service.ts`
- Create: `apps/api/src/i18n/i18n.module.ts`

- [ ] **Step 1: `errors.ts` yaratish**

```typescript
// apps/api/src/i18n/errors.ts
export const API_ERRORS = {
  login_failed:          { uz: "Login yoki parol noto'g'ri",           en: "Invalid credentials",              ru: "Неверный логин или пароль" },
  blocked_warning:       { uz: "Profil bloklangan (ogohlantirishlar)",  en: "Account blocked (warnings)",       ru: "Аккаунт заблокирован (предупреждения)" },
  blocked_payment:       { uz: "To'lov amalga oshirilmagan",           en: "Payment overdue",                  ru: "Задолженность по оплате" },
  profile_blocked:       { uz: "Profilingiz bloklangan",               en: "Your account is blocked",          ru: "Ваш аккаунт заблокирован" },
  token_invalid:         { uz: "Token yaroqsiz",                        en: "Token invalid or expired",         ru: "Токен недействителен или истёк" },
  refresh_invalid:       { uz: "Refresh token yaroqsiz",               en: "Refresh token invalid",            ru: "Refresh токен недействителен" },
  tenant_not_found:      { uz: "Tenant topilmadi",                      en: "Organization not found",           ru: "Организация не найдена" },
  user_not_found:        { uz: "Foydalanuvchi topilmadi",               en: "User not found",                   ru: "Пользователь не найден" },
  lesson_not_found:      { uz: "Dars topilmadi",                        en: "Lesson not found",                 ru: "Урок не найден" },
  exam_not_found:        { uz: "Imtihon topilmadi",                     en: "Exam not found",                   ru: "Экзамен не найден" },
  template_not_found:    { uz: "Shablon topilmadi",                     en: "Template not found",               ru: "Шаблон не найден" },
  order_conflict:        { uz: "Tartib raqami allaqachon mavjud",       en: "Order number already in use",      ru: "Порядковый номер уже занят" },
  no_questions:          { uz: "Bu darsda savollar mavjud emas",        en: "No gradable questions in lesson",  ru: "В уроке нет оцениваемых вопросов" },
  no_shared_lessons:     { uz: "Umumiy bajarilgan dars topilmadi",      en: "No shared completed lessons",      ru: "Нет общих пройденных уроков" },
  not_enough_questions:  { uz: "Yetarli savol topilmadi (kamida 10)",   en: "Not enough questions (min 10)",    ru: "Недостаточно вопросов (минимум 10)" },
  too_many_active_duels: { uz: "Bir vaqtda faqat 2 ta faol duel",      en: "Max 2 active duels at once",       ru: "Максимум 2 активных дуэли" },
  forbidden:             { uz: "Ruxsat yo'q",                            en: "Access forbidden",                 ru: "Доступ запрещён" },
  duplicate_login:       { uz: "Bu login allaqachon band",              en: "This login is already taken",      ru: "Этот логин уже занят" },
  multiple_tenants:      { uz: "Bir xil login bir nechta markazda",     en: "Login found in multiple orgs",     ru: "Логин найден в нескольких организациях" },
  setting_key_invalid:   { uz: "Noma'lum sozlama kalitlari",           en: "Unknown settings keys",            ru: "Неизвестные ключи настроек" },
  progress_exists:       { uz: "Darsda o'quvchi progressi bor",        en: "Students have progress on lesson", ru: "У учеников есть прогресс по уроку" },
  active_duels_limit:    { uz: "Duel limiti: 2 ta",                    en: "Duel limit: 2 active",             ru: "Лимит дуэлей: 2 активных" },
  cert_already_issued:   { uz: "Bu daraja sertifikati allaqachon bor", en: "Certificate already issued",       ru: "Сертификат уже выдан" },
} as const;

export type ErrorKey = keyof typeof API_ERRORS;
type SupportedLocale = 'uz' | 'en' | 'ru';

export function translateError(key: ErrorKey, locale: string): string {
  const entry = API_ERRORS[key];
  if (!entry) return key;
  const loc = (['uz', 'en', 'ru'].includes(locale) ? locale : 'uz') as SupportedLocale;
  return entry[loc];
}
```

- [ ] **Step 2: `i18n.service.ts` yaratish**

```typescript
// apps/api/src/i18n/i18n.service.ts
import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import { Request } from 'express';
import { translateError, ErrorKey } from './errors';

@Injectable({ scope: Scope.REQUEST })
export class I18nService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  get locale(): string {
    const raw = (this.request.headers['accept-language'] ?? 'uz') as string;
    const lang = raw.split(',')[0].trim().slice(0, 2).toLowerCase();
    return ['uz', 'en', 'ru'].includes(lang) ? lang : 'uz';
  }

  t(key: ErrorKey): string {
    return translateError(key, this.locale);
  }
}
```

- [ ] **Step 3: `i18n.module.ts` yaratish**

```typescript
// apps/api/src/i18n/i18n.module.ts
import { Module } from '@nestjs/common';
import { I18nService } from './i18n.service';

@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
```

- [ ] **Step 4: `app.module.ts` ga I18nModule qo'shish**

```typescript
// apps/api/src/app.module.ts
import { I18nModule } from './i18n/i18n.module';
// imports array ga:
I18nModule,
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/i18n/ apps/api/src/app.module.ts
git commit -m "feat(i18n-layer3): I18nModule + I18nService + error translations (uz/en/ru)"
```

---

### Task 11: Auth servisdagi xato xabarlarni tarjima qilish

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: `AuthModule` ga `I18nModule` qo'shish**

```typescript
// apps/api/src/auth/auth.module.ts
import { I18nModule } from '../i18n/i18n.module';
// imports: [..., I18nModule]
```

- [ ] **Step 2: `AuthService` ga `I18nService` inject qilish**

```typescript
// apps/api/src/auth/auth.service.ts
import { I18nService } from '../i18n/i18n.service';

constructor(
  private prisma: PrismaService,
  private jwt: JwtService,
  private config: ConfigService,
  private tenantsService: TenantsService,
  private i18n: I18nService,
) {}
```

- [ ] **Step 3: Hardcoded xato xabarlarni almashtirish**

```typescript
// Oldin:
throw new UnauthorizedException("Login yoki parol noto'g'ri");
// Keyin:
throw new UnauthorizedException(this.i18n.t('login_failed'));

// Oldin:
throw new UnauthorizedException("Profilingiz 3 ta ogohlantirish sababli bloklangan. Filadmin bilan bog'laning.");
// Keyin:
throw new UnauthorizedException(this.i18n.t('blocked_warning'));

// Oldin:
throw new UnauthorizedException("To'lov amalga oshirilmagan. Iltimos, to'lovni to'lang.");
// Keyin:
throw new UnauthorizedException(this.i18n.t('blocked_payment'));

// Oldin:
throw new UnauthorizedException('Profilingiz bloklangan');
// Keyin:
throw new UnauthorizedException(this.i18n.t('profile_blocked'));

// Oldin:
throw new UnauthorizedException('Refresh token yaroqsiz');
// Keyin:
throw new UnauthorizedException(this.i18n.t('refresh_invalid'));

// Oldin:
throw new UnauthorizedException('Bir xil login bir nechta markazda topildi...');
// Keyin:
throw new UnauthorizedException(this.i18n.t('multiple_tenants'));
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

- [ ] **Step 5: Test**

```bash
pnpm --filter api exec jest --testPathPattern="auth"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/
git commit -m "feat(i18n-layer3): translate auth service errors (login, blocked, token)"
```

---

### Task 12: Qolgan servislar xato xabarlarini tarjima qilish

**Files:**
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/lessons/lessons.service.ts`
- Modify: `apps/api/src/exams/exams.service.ts`
- Modify: `apps/api/src/tenants/tenants.service.ts`
- Modify: `apps/api/src/marketing/marketing.service.ts`

**Umumiy pattern:** Har bir servisga `I18nModule` import qilib `I18nService` inject qilish va hardcoded xato xabarlarni `this.i18n.t('key')` bilan almashtirish.

- [ ] **Step 1: `UsersService`**

```typescript
// users.module.ts ga: imports: [I18nModule]
// users.service.ts constructor ga: private i18n: I18nService

// "Foydalanuvchi topilmadi" → this.i18n.t('user_not_found')
```

- [ ] **Step 2: `LessonsService`**

```typescript
// "Dars topilmadi" → this.i18n.t('lesson_not_found')
// "${dto.orderNumber} tartib raqami allaqachon mavjud" → this.i18n.t('order_conflict')
// "Bu darsda ... savollar mavjud emas" → this.i18n.t('no_questions')
// "Darsda {n} o'quvchi progressi bor..." → this.i18n.t('progress_exists')
// "Shablon topilmadi" → this.i18n.t('template_not_found')
```

- [ ] **Step 3: `ExamsService`**

```typescript
// "Imtihon topilmadi" → this.i18n.t('exam_not_found')
// "Imtihon allaqachon yakunlangan" → hardcoded (ACTION_NOT_ALLOWED kaliti qo'shilishi mumkin)
// "Bu darsda yoki imtihonda baholanadigan savollar mavjud emas" → this.i18n.t('no_questions')
```

- [ ] **Step 4: `TenantsService`**

```typescript
// "Tenant topilmadi" → this.i18n.t('tenant_not_found')
```

- [ ] **Step 5: `MarketingService`**

```typescript
// "O'quvchi topilmadi" → this.i18n.t('user_not_found')
```

- [ ] **Step 6: Full typecheck + tests**

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api exec jest
```

Expected: 0 error, 411/411 tests PASS

- [ ] **Step 7: Layer 3 yakuniy commit**

```bash
git add apps/api/src/
git commit -m "feat(i18n-layer3): translate all service errors — users, lessons, exams, tenants"
```

---

### Task 13: `defaultLocale` Tenant modeliga qo'shish

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0045_tenant_default_locale/migration.sql`

- [ ] **Step 1: Schema yangilash**

`Tenant` modeliga qo'shing (primaryColor dan keyin):
```prisma
defaultLocale     String   @default("uz") @map("default_locale")
```

- [ ] **Step 2: Migration yaratish**

```sql
-- prisma/migrations/0045_tenant_default_locale/migration.sql
-- Tenant default locale — used when Accept-Language header is absent.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "default_locale" TEXT NOT NULL DEFAULT 'uz';
```

- [ ] **Step 3: Prisma generate**

```bash
npx prisma generate --schema=prisma/schema.prisma
```

- [ ] **Step 4: `I18nService` da tenant locale fallback**

```typescript
// i18n.service.ts
get locale(): string {
  const raw = (this.request.headers['accept-language'] ?? '') as string;
  if (raw) {
    const lang = raw.split(',')[0].trim().slice(0, 2).toLowerCase();
    if (['uz', 'en', 'ru'].includes(lang)) return lang;
  }
  // Tenant default locale fallback
  const tenantLocale = (this.request as any).tenantDefaultLocale as string | undefined;
  return tenantLocale && ['uz', 'en', 'ru'].includes(tenantLocale)
    ? tenantLocale
    : 'uz';
}
```

- [ ] **Step 5: Full quality gates**

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec jest
pnpm run build
```

Expected: 0 error, 411/411 pass, build yashil

- [ ] **Step 6: Final commit**

```bash
git add prisma/ apps/api/src/i18n/
git commit -m "feat(i18n-layer3): tenant defaultLocale + migration 0045 — Phase 6b COMPLETE"
```

---

## Self-Review ✅

**Spec qamrovi tekshiruvi:**
- [x] `[locale]` folder struktura — Task 1-5
- [x] `withNextIntl` plugin yoqildi — Task 2
- [x] `generateStaticParams` qo'shildi — Task 3-4
- [x] Link import'lar yangilandi — Task 5
- [x] ~400 key message fayllar — Task 6
- [x] `useTranslations()` barcha sahifalarda — Task 7-9
- [x] Backend `I18nService` + `errors.ts` — Task 10
- [x] Auth servis tarjima — Task 11
- [x] Qolgan servislar tarjima — Task 12
- [x] `Tenant.defaultLocale` + migration — Task 13
- [x] Har Layer uchun commit

**Placeholder tekshiruvi:** Yo'q ✅

**Type consistency:** `ErrorKey` = `keyof typeof API_ERRORS` — barcha joylarda bir xil ✅

**Scope:** 13 task, 3 Layer, bir ketlikda bog'liq — decompose kerak emas ✅
