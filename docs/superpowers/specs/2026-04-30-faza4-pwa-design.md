# Faza 4 — PWA & Offline Design

**Goal:** Alochi web app'ini Progressive Web App'ga aylantirish — install qilinadigan, minimal offline support bilan.

**Scope:** Faqat client-side. Backend o'zgarishlari yo'q. Browser push notifications yo'q (Telegram bot yetarli).

---

## 1. Maqsad va cheklovlar

**Maqsadlar:**
- Foydalanuvchilar app'ni telefoniga "o'rnatishi" mumkin (Add to Home Screen)
- Internet yo'qolsa, blank screen o'rniga "offline" xabar
- Avval ko'rilgan sahifalar offline'da ham ko'rinadi (cached HTML/JS/CSS)
- Lighthouse PWA audit kamida 90+ ball

**Cheklovlar (YAGNI):**
- Foydalanuvchi offline rejimda **javob yubormaydi** — faqat sahifalarni ko'radi
- Browser push notifications **yo'q** — Telegram bot xabar beradi
- Background sync **yo'q**
- API responselari cached **emas** (xavfsizlik + RBAC)
- Login sahifa cached **emas**

---

## 2. Texnologiya tanlovi

**`@ducanh2912/next-pwa`** — Next.js uchun PWA plugin. Original `next-pwa` ning faol fork'i. Workbox orqali avtomatik service worker generatsiya qiladi.

**Sabab:** Zero-config, Next.js 15 bilan mos, ichki Workbox API'larni "magic" tarzda yashiradi. Manual service worker yozish katta loyihalar uchun, hozirgi minimal scope uchun overkill.

---

## 3. Arxitektura

```
apps/web/
├── public/
│   ├── manifest.json              # App metadata
│   ├── icons/
│   │   ├── icon-192.png           # Android home screen
│   │   ├── icon-512.png           # Splash screen
│   │   └── icon-maskable-512.png  # Android adaptive icon
│   ├── apple-touch-icon.png       # iOS home screen
│   ├── sw.js                      # GENERATED — gitignore
│   └── workbox-*.js               # GENERATED — gitignore
├── app/
│   ├── layout.tsx                 # manifest metadata
│   ├── (dashboard)/layout.tsx     # <InstallPrompt /> render
│   └── offline/
│       └── page.tsx               # Offline fallback sahifa
├── components/
│   └── InstallPrompt.tsx          # PWA install banner
├── next.config.ts                 # withPWA wrapper
├── package.json                   # @ducanh2912/next-pwa
└── .gitignore                     # public/sw.js, public/workbox-*.js
```

---

## 4. Manifest

**`public/manifest.json`:**
```json
{
  "name": "Alochi — O'qish platformasi",
  "short_name": "Alochi",
  "description": "Online o'qish va boshqaruv platformasi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#1e293b",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Ranglar:** Loyiha hozirgi dark navy dizayni bilan mos (`#0f172a` = slate-900, `#1e293b` = slate-800).

**Display: standalone** — install qilinganda browser UI'siz ochiladi.

---

## 5. Ikonkalar

4 ta PNG fayl `public/icons/` va `public/` da:

| Fayl | O'lcham | Maqsad |
|------|---------|--------|
| `icons/icon-192.png` | 192×192 | Android home screen, manifest |
| `icons/icon-512.png` | 512×512 | Splash screen, manifest |
| `icons/icon-maskable-512.png` | 512×512 | Android adaptive icon (margin bilan) |
| `apple-touch-icon.png` | 180×180 | iOS home screen |

**Yaratish:** Hozir loyihada logo yo'q. Placeholder yaratiladi: slate-800 (`#1e293b`) fon, oq "A" harfi markazda. Keyin dizayner almashtiradi.

**Maskable icon:** 80% area inner safe zone (Android adaptive masking uchun).

---

## 6. Next.js konfiguratsiya

**`next.config.ts`:**
```ts
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // mavjud config
};

export default withPWA(nextConfig);
```

**`disable: development`** — dev modeda PWA o'chirilgan (HMR'ga xalaqit qilmasligi uchun).

---

## 7. Caching strategiyasi

`@ducanh2912/next-pwa` default Workbox strategiyalari ishlatiladi (custom override yo'q):

| Resurs | Strategiya | TTL |
|--------|------------|-----|
| `/_next/static/**` (JS/CSS) | CacheFirst | ∞ (build hash bor) |
| HTML sahifalar | NetworkFirst | 1 kun |
| `/icons/**`, rasmlar | StaleWhileRevalidate | 30 kun |
| Fontlar | CacheFirst | 1 yil |
| `/api/**` | **NetworkOnly** (cached emas) | — |

**`/api/**` cached emas** — sabab: auth, RBAC, tenant scoping. Cached API javob noto'g'ri foydalanuvchiga ko'rinishi mumkin.

**Login sahifa cached emas** — `/login`, `/[tenant]/login` ham NetworkOnly. Logout'dan keyin eski cached sahifa ko'rinmasligi uchun.

---

## 8. Offline fallback sahifa

**`app/offline/page.tsx`:**

Static sahifa (no client component, no API). Mazmuni:
- Sarlavha: "Internet aloqasi yo'q"
- Tushuntirish: "Sahifa yuklanishi uchun internetga ulaning. Avval ko'rgan sahifalaringiz hali ham ochiladi."
- Tugma: "Qayta urinish" (window.location.reload)

Stil: dark navy (slate-900 fon, slate-200 matn), markazlashgan, `lucide-react` `WifiOff` ikonka.

---

## 9. Install prompt

**`components/InstallPrompt.tsx`** (client component):

**Logika:**
1. Mount'da `localStorage.getItem('pwa-install-dismissed')` tekshirish — `'1'` bo'lsa render yo'q
2. `window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setDeferred(e); })`
3. `setDeferred(e)` bo'lsa banner ko'rsatish
4. "O'rnatish" tugma → `deferred.prompt()`, javob bo'lsa banner yopiladi
5. "Yo'q" tugma → `localStorage.setItem('pwa-install-dismissed', '1')`, banner yopiladi

**iOS Safari (alohida):**
iOS `beforeinstallprompt` event'ini emit qilmaydi. User-agent'dan iOS Safari deb aniqlanasa, alohida banner: "Alochi'ni o'rnatish uchun Share tugmasi → Add to Home Screen".

**UI:**
- `fixed bottom-4 right-4 max-w-xs z-50`
- Slate-800 fon, slate-700 border, rounded-xl
- Sarlavha "Alochi'ni o'rnatish" + qisqa tushuntirish
- 2 tugma: "O'rnatish" (blue), "Yo'q" (slate)

**Render qaerda:** `app/(dashboard)/layout.tsx` ga qo'shiladi (faqat login qilgandan keyin ko'rinadi).

---

## 10. `app/layout.tsx` o'zgarishlari

Mavjud `metadata` object'ga qo'shiladi:

```tsx
export const metadata: Metadata = {
  // mavjud title, description...
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Alochi',
  },
  themeColor: '#1e293b',
};
```

---

## 11. .gitignore

`apps/web/.gitignore` ga qo'shiladi:
```
# PWA generated files
public/sw.js
public/sw.js.map
public/workbox-*.js
public/workbox-*.js.map
```

Bu fayllar `npm run build` paytida har safar yangidan generatsiya qilinadi.

---

## 12. Testing

**Unit test:** Yo'q. PWA infra, manual testing yetarli.

**Manual test checklist:**
1. `pnpm --filter @alochi/web build && pnpm --filter @alochi/web start`
2. Chrome DevTools → Application → Manifest — manifest yuklangan, ikonkalar ko'rinadi
3. Application → Service Workers — `sw.js` registered, status: "activated"
4. Network tab → Throttling → "Offline" — sahifani qayta yuklash → `/offline` ochiladi
5. Avval ko'rilgan sahifa offline rejimda ham ochilishini tekshirish
6. Chrome DevTools → Lighthouse → PWA audit — 90+ ball
7. Android Chrome (yoki `chrome://inspect`) — install banner ko'rinishi

**CI verification:** TypeScript va `pnpm build` pass etishi yetarli.

---

## 13. Xavfsizlik mulohazalari

1. **`/api/**` cached emas** — cached API javob boshqa foydalanuvchiga ko'rinmaydi
2. **Login sahifa cached emas** — logout'dan keyin eski sahifa ko'rinmasligi uchun
3. **`accessToken` localStorage'da** — service worker uni o'qimaydi
4. **HTTPS majburiy** — service worker faqat HTTPS yoki localhost'da ishlaydi (production'da allaqachon HTTPS)

---

## 14. Faza 4 dan tashqari (kelajak)

Quyidagi xususiyatlar **bu spec qamroviga kirmaydi:**

| Xususiyat | Sabab |
|-----------|-------|
| Browser push notifications | Telegram bot yetarli, infra murakkab |
| Background sync (offline javob yuborish) | Konflikt resolution kerak — alohida loyiha |
| IndexedDB lesson cache | Faqat sahifa cache, content cache emas |
| Update notification UI ("Yangi versiya bor, qayta yuklang") | Workbox default behavior yetarli |
| Lighthouse CI | Hozircha manual audit yetarli |
| Custom splash screens (iOS) | Default OS splash yetarli |
