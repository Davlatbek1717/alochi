import Image from 'next/image';
import Link from 'next/link';
import { Send } from 'lucide-react';
import type { LandingCms } from './cms-types';

// Brand icons aren't in our lucide-react version (1.11.0) — use compact
// inline SVGs to keep the footer self-contained without adding deps.
const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const YoutubeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5C1.6 10.4 1.6 12 1.6 12s0 1.6.4 3.5a3 3 0 0 0 2.1 2.1c1.9.4 7.9.4 7.9.4s6 0 7.9-.4a3 3 0 0 0 2.1-2.1c.4-1.9.4-3.5.4-3.5s0-1.6-.4-3.5z" />
    <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
  </svg>
);

const STATIC_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Mahsulot',
    links: [
      { label: 'Imkoniyatlar', href: '#features' },
      { label: 'Rollar', href: '#roles' },
      { label: 'Narxlar', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Markazlar uchun',
    links: [
      { label: "Demo so'rash", href: '#pricing' },
      { label: "Bog'lanish", href: 'mailto:hello@alochi.com' },
      { label: 'Hujjatlar', href: '#faq' },
    ],
  },
  {
    title: 'Xavfsizlik',
    links: [
      { label: 'PDPL talablari', href: '#faq' },
      { label: 'Maxfiylik siyosati', href: '#faq' },
      { label: 'Xodim qoidalari', href: '#faq' },
    ],
  },
];

interface FooterProps {
  cms?: LandingCms['contact'] | null;
}

export function Footer({ cms }: FooterProps) {
  const phone = cms?.phone || '+998 88 081 81 88';
  const email = cms?.email || 'javohir.uh@gmail.com';
  const address = cms?.address || "Buxoro vil., G'ijduvon tumani";
  const telegram = cms?.telegram || 'https://t.me/alochibolajon';
  const personal = cms?.personal || 'https://t.me/Javohir_UH';

  // Build contact column from CMS values
  const contactLinks = [
    { label: telegram.replace('https://t.me/', '@'), href: telegram },
    { label: personal.replace('https://t.me/', '@'), href: personal },
    { label: email, href: `mailto:${email}` },
    { label: phone, href: `tel:${phone.replace(/\s/g, '')}` },
    { label: address, href: '#' },
  ];

  const COLS = [
    ...STATIC_COLS,
    { title: 'Aloqa', links: contactLinks },
  ];

  return (
    <footer className="bg-[#0f172a] text-slate-300 border-t border-[#0a0f1f]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <Image
                src="/logo-mark.svg"
                alt=""
                aria-hidden
                width={36}
                height={36}
                className="h-9 w-9 brightness-110"
              />
              <span className="text-xl font-extrabold text-white tracking-tight">
                A&apos;lochi
              </span>
            </Link>
            <p className="mt-4 text-sm font-semibold text-slate-400 max-w-xs leading-relaxed">
              Bolangizning muvaffaqiyat yo&apos;li. O&apos;zbekistonda yaratilgan zamonaviy
              ta&apos;lim SaaS platformasi.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <a
                href="https://t.me/alochi_bot"
                aria-label="Telegram"
                className="grid place-items-center w-9 h-9 rounded-full bg-white/8 hover:bg-[#6d28d9] text-slate-300 hover:text-white transition-colors"
              >
                <Send size={16} strokeWidth={2.5} />
              </a>
              <a
                href="https://instagram.com/alochi.uz"
                aria-label="Instagram"
                className="grid place-items-center w-9 h-9 rounded-full bg-white/8 hover:bg-[#f97316] text-slate-300 hover:text-white transition-colors"
              >
                <InstagramIcon size={16} />
              </a>
              <a
                href="https://youtube.com/@alochi"
                aria-label="YouTube"
                className="grid place-items-center w-9 h-9 rounded-full bg-white/8 hover:bg-[#ef4444] text-slate-300 hover:text-white transition-colors"
              >
                <YoutubeIcon size={16} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.title} className="col-span-1">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-white">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 pt-6 border-t border-white/8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs font-bold text-slate-500">
          <span>© 2026 A&apos;lochi. Barcha huquqlar himoyalangan.</span>
          <span className="inline-flex items-center gap-1.5">
            Made in Uzbekistan <span aria-hidden>🇺🇿</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
