'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

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
        'sticky top-0 z-40 w-full transition-all duration-300',
        scrolled
          ? 'backdrop-blur-xl bg-[var(--background)]/85 border-b border-[var(--line)] shadow-[0_2px_24px_-16px_rgba(30,27,75,0.20)]'
          : 'bg-transparent border-b border-transparent',
      ].join(' ')}
    >
      <div
        className={[
          'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
          'flex items-center gap-6 transition-all duration-300',
          scrolled ? 'h-14' : 'h-20',
        ].join(' ')}
      >
        {/* Logo lockup */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group"
          aria-label="A'lochi bosh sahifa"
        >
          <span className="relative inline-flex items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 -m-1 rounded-full bg-[var(--brand)]/12 blur-lg opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <Image
              src="/logo-mark.svg"
              alt=""
              aria-hidden
              width={36}
              height={36}
              className="relative h-9 w-9 transition-transform duration-300 group-hover:rotate-[-8deg]"
              priority
            />
          </span>
          <span className="font-display text-2xl font-extrabold text-[var(--ink)] tracking-tight leading-none">
            A&apos;lochi
          </span>
        </Link>

        {/* Center nav — desktop */}
        <nav
          className="hidden lg:flex items-center gap-1 mx-auto"
          aria-label="Asosiy navigatsiya"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative px-3.5 py-2 text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--brand)] rounded-lg transition-colors group"
            >
              {item.label}
              <span
                aria-hidden
                className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-[var(--brand)] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out rounded-full"
              />
            </a>
          ))}
        </nav>

        {/* Right CTAs — desktop */}
        <div className="hidden lg:flex items-center gap-2 ml-auto">
          <Link
            href="/login"
            className="text-sm font-semibold text-[var(--ink-2)] hover:text-[var(--brand)] px-3.5 py-2 rounded-lg transition-colors"
          >
            Kirish
          </Link>
          <button
            type="button"
            onClick={onDemoClick}
            className={[
              'inline-flex items-center gap-2',
              'bg-[var(--brand)] text-white font-extrabold text-sm tracking-wide',
              'px-4 py-2.5 rounded-xl',
              'border-b-[3px] border-[var(--brand-deep)]',
              'hover:bg-[var(--brand-strong)]',
              'active:translate-y-[2px] active:border-b-[1px]',
              'transition-all duration-150 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
            ].join(' ')}
          >
            Tizimga kirish
            <ArrowRight size={16} strokeWidth={2.75} />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden ml-auto p-2 rounded-lg text-[var(--ink)] hover:bg-[var(--brand-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
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
          className="lg:hidden border-t border-[var(--line)] bg-[var(--background)]/98 backdrop-blur-xl"
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-3 text-base font-semibold text-[var(--ink)] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="px-3 py-3 text-base font-semibold text-[var(--ink)] rounded-lg hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] transition-colors"
            >
              Kirish
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDemoClick();
              }}
              className={[
                'mt-2 inline-flex items-center justify-center gap-2',
                'bg-[var(--brand)] text-white font-extrabold text-base',
                'px-4 py-3 rounded-xl',
                'border-b-[4px] border-[var(--brand-deep)]',
                'active:translate-y-[2px] active:border-b-[1px]',
                'transition-all',
              ].join(' ')}
            >
              Tizimga kirish
              <ArrowRight size={18} strokeWidth={2.75} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
