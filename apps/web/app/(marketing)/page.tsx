import type { Metadata } from 'next';
import { LandingShell } from './_components/LandingShell';
import type { LandingCms } from './_components/cms-types';

const SITE_DESCRIPTION =
  "3-7 sinf o'quvchilari uchun ingliz tili, shaxsiy rivojlanish va tanqidiy fikrlashni o'rgatuvchi zamonaviy SaaS platforma. AI suhbatlar, kamera nazorati, ota-onalar uchun Telegram hisobotlar.";

export const metadata: Metadata = {
  title: "A'lochi — O'zbekistondagi zamonaviy ta'lim SaaS platformasi",
  description: SITE_DESCRIPTION,
  keywords: [
    "A'lochi",
    "ta'lim platformasi",
    "SaaS",
    "O'zbekiston",
    'EdTech',
    "o'quv markazi",
    "ingliz tili",
    'AI lessons',
    'Claude',
    'PWA',
  ],
  openGraph: {
    title: "A'lochi — Bolangizning muvaffaqiyat yo'li",
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'uz_UZ',
    type: 'website',
    siteName: "A'lochi",
  },
  twitter: {
    card: 'summary_large_image',
    title: "A'lochi",
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
  alternates: { canonical: 'https://alochi.uz/' },
};

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: "A'lochi",
  description: SITE_DESCRIPTION,
  url: 'https://alochi.uz',
  logo: 'https://alochi.uz/logo.svg',
  sameAs: [
    'https://t.me/alochi_bot',
    'https://instagram.com/alochi.uz',
    'https://youtube.com/@alochi',
  ],
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: 'hello@alochi.uz',
      areaServed: 'UZ',
      availableLanguage: ['uz', 'ru'],
    },
  ],
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function fetchCms(): Promise<LandingCms | null> {
  try {
    const res = await fetch(`${API_BASE}/marketing/landing`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: LandingCms } | LandingCms;
    if (json && typeof json === 'object' && 'data' in json && json.data) {
      return json.data as LandingCms;
    }
    return json as LandingCms;
  } catch {
    return null;
  }
}

export default async function MarketingHome() {
  const cms = await fetchCms();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_LD) }}
      />
      <LandingShell cms={cms} />
    </>
  );
}
