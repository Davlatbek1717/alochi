'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Locale = 'uz' | 'en' | 'ru';
const LOCALES: Locale[] = ['uz', 'en', 'ru'];
const LOCALE_LABELS: Record<Locale, string> = {
  uz: '🇺🇿 UZ',
  en: '🇬🇧 EN',
  ru: '🇷🇺 RU',
};

// Phase 6 infrastructure — next-intl plugin and [locale] folder migration
// (Phase 6b) will wire full SSR locale detection. For now we use a simple
// localStorage preference that next-intl middleware will honour on the
// next request via the `NEXT_LOCALE` cookie.
function getLocale(): Locale {
  if (typeof window === 'undefined') return 'uz';
  const stored = localStorage.getItem('locale') as Locale | null;
  if (stored && LOCALES.includes(stored)) return stored;
  const lang = navigator.language.slice(0, 2) as Locale;
  return LOCALES.includes(lang) ? lang : 'uz';
}

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>('uz');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setLocale(getLocale());
  }, []);

  function switchLocale(next: Locale) {
    localStorage.setItem('locale', next);
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    setLocale(next);
    // Force a navigation so middleware picks up the new cookie.
    router.refresh();
    // If switching to a locale with a path prefix, redirect appropriately.
    if (next === 'uz') {
      router.replace(pathname.replace(/^\/(en|ru)/, '') || '/');
    } else {
      const base = pathname.replace(/^\/(en|ru)/, '');
      router.replace(`/${next}${base}`);
    }
  }

  return (
    <div className="flex items-center gap-0.5" aria-label="Language switcher">
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => switchLocale(loc)}
          aria-current={loc === locale ? 'true' : undefined}
          className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
            loc === locale
              ? 'bg-[#6d28d9] text-white'
              : 'text-[#1e1b4b]/70 hover:text-[#6d28d9] hover:bg-[#6d28d9]/8'
          }`}
        >
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
