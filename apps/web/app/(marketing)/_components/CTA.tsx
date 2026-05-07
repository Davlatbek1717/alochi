'use client';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';

interface Props {
  onDemoClick: () => void;
}

export function CTA({ onDemoClick }: Props) {
  return (
    <section
      aria-labelledby="cta-h2"
      className="relative overflow-hidden bg-[#0f0c2d]"
    >
      {/* Layered atmosphere */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 right-0 w-[560px] h-[420px] rounded-full bg-[var(--brand)]/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[480px] h-[300px] rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute top-1/2 -right-20 w-[280px] h-[280px] rounded-full bg-[#fbbf24]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div
          className={[
            'relative bg-[var(--background)]',
            'rounded-3xl',
            'border border-[var(--accent)]/30',
            'shadow-[0_40px_100px_-40px_rgba(0,0,0,0.7)]',
            'px-6 py-14 sm:px-14 sm:py-20 lg:py-24',
            'overflow-hidden grain',
          ].join(' ')}
        >
          <div
            className="hidden lg:block absolute -right-4 bottom-0 pointer-events-none"
            aria-hidden
          >
            <Mascot expression="happy" size={240} animated />
          </div>

          <div
            aria-hidden
            className="absolute inset-0 grid-mask opacity-50 pointer-events-none"
          />

          <div className="max-w-2xl relative">
            <span
              className={[
                'inline-flex items-center gap-2',
                'px-3.5 py-1.5 rounded-full',
                'bg-[var(--brand-soft)] border border-[var(--brand)]/15',
                'text-[var(--brand)] text-[11px] font-extrabold uppercase tracking-[0.2em]',
              ].join(' ')}
            >
              <Sparkles size={13} strokeWidth={2.75} />
              Keyingi qadam
            </span>
            <h2
              id="cta-h2"
              className="font-display mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
            >
              Markazingizni{' '}
              <span className="italic font-medium text-[var(--brand)]">
                keyingi avlod
              </span>{' '}
              platformasiga oling.
            </h2>
            <p className="mt-7 text-lg text-[var(--ink-2)] leading-relaxed max-w-xl">
              Tizimga kirib, A&apos;lochi platformasini bugundan ishlatishni
              boshlang. Markazingiz, mentorlar va o&apos;quvchilar bir
              joyda — barchasi 30 daqiqada sozlanadi.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onDemoClick}
                className={[
                  'group inline-flex items-center justify-center gap-2.5',
                  'bg-[var(--brand)] text-white font-extrabold text-base tracking-wide',
                  'px-7 py-4 rounded-2xl',
                  'border-b-[5px] border-[var(--brand-deep)]',
                  'hover:bg-[var(--brand-strong)]',
                  'active:translate-y-[3px] active:border-b-[2px]',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
                ].join(' ')}
              >
                Tizimga kirish
                <ArrowRight
                  size={18}
                  strokeWidth={2.75}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </button>
              <a
                href="#capabilities"
                className={[
                  'inline-flex items-center justify-center gap-2',
                  'bg-[var(--surface)] text-[var(--ink)] font-extrabold text-base tracking-wide',
                  'px-7 py-4 rounded-2xl',
                  'border-[1.5px] border-[var(--line-strong)]',
                  'hover:border-[var(--brand)]/40 hover:bg-[var(--surface-2)]',
                  'transition-all duration-150',
                ].join(' ')}
              >
                Imkoniyatlarni ko&apos;rish
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
