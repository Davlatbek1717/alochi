import Image from 'next/image';
import Link from 'next/link';
import { Send } from 'lucide-react';
import type { LandingCms } from './cms-types';

const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const YoutubeIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5C1.6 10.4 1.6 12 1.6 12s0 1.6.4 3.5a3 3 0 0 0 2.1 2.1c1.9.4 7.9.4 7.9.4s6 0 7.9-.4a3 3 0 0 0 2.1-2.1c.4-1.9.4-3.5.4-3.5s0-1.6-.4-3.5z" />
    <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
  </svg>
);

const STATIC_COLS: { title: string; links: { label: string; href: string }[] }[] =
  [
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
        { label: 'Maxfiylik siyosati', href: '/privacy' },
        { label: 'Xizmat shartlari', href: '/terms' },
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

  const contactLinks = [
    { label: telegram.replace('https://t.me/', '@'), href: telegram },
    { label: personal.replace('https://t.me/', '@'), href: personal },
    { label: email, href: `mailto:${email}` },
    { label: phone, href: `tel:${phone.replace(/\s/g, '')}` },
    { label: address, href: '#' },
  ];

  const COLS = [...STATIC_COLS, { title: 'Aloqa', links: contactLinks }];

  return (
    <footer className="relative bg-[#0f0c2d] text-slate-300 overflow-hidden">
      {/* Subtle violet glow at top, gold accent at bottom-right */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-24 left-1/4 w-[480px] h-[240px] bg-[var(--brand)]/16 blur-3xl" />
        <div className="absolute -bottom-12 right-0 w-[320px] h-[240px] bg-[var(--accent)]/10 blur-3xl" />
      </div>

      {/* Top hairline seam — slim violet → gold gradient */}
      <div
        aria-hidden
        className="h-[2px] bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-40"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <Image
                src="/logo-mark.svg"
                alt=""
                aria-hidden
                width={40}
                height={40}
                className="h-10 w-10 brightness-110 transition-transform duration-300 group-hover:rotate-[-8deg]"
              />
              <span className="font-display text-2xl font-bold text-white tracking-tight">
                A&apos;lochi
              </span>
            </Link>
            <p className="mt-5 text-sm text-slate-400 max-w-xs leading-relaxed">
              Bolangizning muvaffaqiyat yo&apos;li. O&apos;zbekistonda
              yaratilgan zamonaviy ta&apos;lim SaaS platformasi.
            </p>

            <div className="mt-7 flex items-center gap-2">
              <a
                href="https://t.me/alochi_bot"
                aria-label="Telegram"
                className="grid place-items-center w-10 h-10 rounded-xl bg-white/6 hover:bg-[var(--brand)] text-slate-300 hover:text-white transition-all duration-200 hover:scale-105 hover:-translate-y-0.5"
              >
                <Send size={16} strokeWidth={2.5} />
              </a>
              <a
                href="https://instagram.com/alochi.uz"
                aria-label="Instagram"
                className="grid place-items-center w-10 h-10 rounded-xl bg-white/6 hover:bg-[var(--accent)] text-slate-300 hover:text-white transition-all duration-200 hover:scale-105 hover:-translate-y-0.5"
              >
                <InstagramIcon size={16} />
              </a>
              <a
                href="https://youtube.com/@alochi"
                aria-label="YouTube"
                className="grid place-items-center w-10 h-10 rounded-xl bg-white/6 hover:bg-[var(--danger)] text-slate-300 hover:text-white transition-all duration-200 hover:scale-105 hover:-translate-y-0.5"
              >
                <YoutubeIcon size={16} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.title} className="col-span-1">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white">
                {col.title}
              </h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150 inline-flex items-center group"
                    >
                      <span
                        aria-hidden
                        className="inline-block w-0 group-hover:w-3 mr-0 group-hover:mr-2 h-[1.5px] bg-[var(--brand)] transition-all duration-200"
                      />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-14 pt-8 border-t border-white/8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs text-slate-500">
          <span>
            © 2026 A&apos;lochi. Barcha huquqlar himoyalangan.
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            Made in Uzbekistan <span aria-hidden>🇺🇿</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
