'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
// LanguageSwitcher deferred until [locale] folder migration (Phase 6b).
// import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const NAV = [
  { href: '#features', label: 'Imkoniyatlar' },
  { href: '#roles', label: 'Rollar' },
  { href: '#pricing', label: 'Narxlar' },
  { href: '#faq', label: 'Savollar' },
];

interface Props {
  onDemoClick: () => void;
}

export function Header({ onDemoClick }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={[
        'sticky top-0 z-40 w-full transition-all',
        scrolled
          ? 'backdrop-blur-md bg-[#fffaf0]/85 border-b border-[#e8e0d0] shadow-[0_2px_18px_-12px_rgba(15,23,42,0.18)]'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center gap-6 transition-all ${scrolled ? 'h-14' : 'h-16'}`}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="Adouptivo bosh sahifa">
          <Image
            src="/logo-mark.svg"
            alt=""
            aria-hidden
            width={36}
            height={36}
            className="h-9 w-9 transition-transform group-hover:rotate-[-6deg]"
            priority
          />
          <span className="text-xl font-extrabold text-[#1e1b4b] tracking-tight">
            Adouptivo
          </span>
        </Link>

        {/* Center nav — desktop */}
        <nav className="hidden lg:flex items-center gap-1 mx-auto" aria-label="Asosiy navigatsiya">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-bold text-[#1e1b4b]/80 hover:text-[#6d28d9] rounded-md hover:bg-[#6d28d9]/8 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right CTAs — desktop */}
        <div className="hidden lg:flex items-center gap-2 ml-auto">
          {/* <LanguageSwitcher /> — deferred Phase 6b */}
          <Link
            href="/login"
            className="text-sm font-bold text-[#1e1b4b]/85 hover:text-[#6d28d9] px-3 py-2 rounded-md transition-colors"
          >
            Kirish
          </Link>
          <button
            type="button"
            onClick={onDemoClick}
            className="inline-flex items-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-sm px-4 py-2.5 rounded-xl shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
          >
            Demo so&apos;rash
            <ArrowRight size={16} strokeWidth={2.75} />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden ml-auto p-2 rounded-md text-[#1e1b4b] hover:bg-[#6d28d9]/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]"
          aria-label={open ? 'Menyuni yopish' : 'Menyuni ochish'}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X size={22} strokeWidth={2.5} /> : <Menu size={22} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="lg:hidden border-t border-[#e8e0d0] bg-[#fffaf0]/98 backdrop-blur-md"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 text-base font-bold text-[#1e1b4b] rounded-lg hover:bg-[#6d28d9]/8 hover:text-[#6d28d9]"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="px-3 py-3 text-base font-bold text-[#1e1b4b] rounded-lg hover:bg-[#6d28d9]/8 hover:text-[#6d28d9]"
            >
              Kirish
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDemoClick();
              }}
              className="mt-2 inline-flex items-center justify-center gap-2 bg-[#6d28d9] text-white font-extrabold text-base px-4 py-3 rounded-xl shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95]"
            >
              Demo so&apos;rash
              <ArrowRight size={18} strokeWidth={2.75} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
