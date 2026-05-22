'use client';
import Link from 'next/link';
import { ArrowRight, Check, Lock, Sparkles } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';
import type { LandingCms } from './cms-types';

interface Props {
  // Kept for landing-shell prop compatibility; Hero no longer surfaces
  // a second CTA, but the shell still passes a login click handler so
  // future hero variants can re-add a secondary button without re-wiring.
  onDemoClick?: () => void;
  cms: LandingCms['hero'] | null;
}

export function Hero({ cms }: Props) {
  const badge = cms?.badge || "O'zbekiston ta'lim platformasi";
  const title =
    cms?.title || "Bolangizning muvaffaqiyat yo'li shu yerdan boshlanadi.";
  const subtitle =
    cms?.subtitle ||
    "3–7 sinf o'quvchilari uchun ingliz tili, shaxsiy rivojlanish va tanqidiy fikrlashni o'rgatuvchi zamonaviy SaaS platforma. AI suhbatlar, kamera nazorati va ota-onalar uchun Telegram hisobotlar.";

  return (
    <section
      aria-labelledby="hero-h1"
      className="relative overflow-hidden hero-glow grain"
    >
      {/* Layered atmosphere ── soft conic glow + grid + grain */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 grid-mask" />
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[var(--accent)]/14 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 w-[480px] h-[480px] rounded-full bg-[var(--brand)]/12 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 lg:pt-24 pb-16 lg:pb-28">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT — copy (8/12 = 66%) */}
          <div
            className="lg:col-span-7 motion-safe:[animation:riseIn_700ms_var(--ease-out-expo)_both]"
          >
            <span
              className={[
                'inline-flex items-center gap-2',
                'px-3.5 py-1.5 rounded-full',
                'bg-[var(--brand-soft)] border border-[var(--brand)]/15',
                'text-[var(--brand)] text-[11px] font-extrabold uppercase tracking-[0.2em]',
              ].join(' ')}
            >
              <Sparkles size={13} strokeWidth={2.75} />
              <span aria-hidden>🇺🇿</span>
              {badge}
            </span>

            <h1
              id="hero-h1"
              className={[
                'font-display mt-6',
                'text-[44px] sm:text-[60px] lg:text-[76px] xl:text-[88px]',
                'font-bold text-[var(--ink)]',
                'leading-[0.95] tracking-[-0.025em]',
              ].join(' ')}
            >
              {title}
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-[var(--ink-2)] max-w-[600px] leading-[1.55]">
              {subtitle}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className={[
                  'group inline-flex items-center justify-center gap-2.5',
                  'bg-[var(--brand)] text-white font-extrabold text-base tracking-wide',
                  'px-7 py-4 rounded-2xl',
                  'border-b-[5px] border-[var(--brand-deep)]',
                  'hover:bg-[var(--brand-strong)]',
                  'active:translate-y-[3px] active:border-b-[2px]',
                  'transition-all duration-150 ease-out',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
                ].join(' ')}
              >
                Tizimga kirish
                <ArrowRight
                  size={18}
                  strokeWidth={2.75}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-2.5 text-xs sm:text-sm font-semibold text-[var(--ink-3)]">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-grid place-items-center w-5 h-5 rounded-full bg-[var(--success-soft)] text-[var(--success)]"
                >
                  <Check size={12} strokeWidth={3.5} />
                </span>
                PDPL talablariga mos
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-grid place-items-center w-5 h-5 rounded-full bg-[var(--success-soft)] text-[var(--success)]"
                >
                  <Check size={12} strokeWidth={3.5} />
                </span>
                Multi-tenant SaaS
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-grid place-items-center w-5 h-5 rounded-full bg-[var(--success-soft)] text-[var(--success)]"
                >
                  <Check size={12} strokeWidth={3.5} />
                </span>
                99.9% uptime
              </span>
            </div>
          </div>

          {/* RIGHT — mascot + floating UI (4/12 = 34%) */}
          <div className="lg:col-span-5 relative h-[440px] sm:h-[500px] lg:h-[580px]">
            {/* Layered halos for depth */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full bg-[var(--accent)]/18 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute left-[58%] top-[42%] -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full bg-[var(--brand)]/10 blur-3xl"
            />

            {/* Mascot center — scaled down on small screens so it never
                collides with / overflows past the floating cards inside
                the shorter mobile column. */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="scale-[0.62] sm:scale-[0.8] lg:scale-100 origin-center">
                <Mascot expression="happy" size={280} animated />
              </div>
            </div>

            {/* Floating: AI tutor card (top-right) */}
            <div
              className={[
                'drift-a absolute top-6 right-2 sm:right-6 rotate-3',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[var(--brand)]/20',
                'px-4 py-3',
                'shadow-[0_18px_40px_-18px_rgba(109,40,217,0.45)]',
              ].join(' ')}
              role="presentation"
              aria-hidden
            >
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--brand)] text-white">
                  <Check size={18} strokeWidth={3} />
                </span>
                <div className="leading-tight">
                  <div className="font-display text-[var(--ink)] font-bold text-sm">
                    AI tutor
                  </div>
                  <div className="text-[var(--ink-3)] text-[10px] font-bold uppercase tracking-[0.15em]">
                    Shaxsiy yondashuv
                  </div>
                </div>
              </div>
            </div>

            {/* Floating: parent report (bottom-left) */}
            <div
              className={[
                'drift-b absolute bottom-12 left-0 sm:left-2 -rotate-3',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[#1cb0f6]/30',
                'px-4 py-3',
                'shadow-[0_18px_40px_-18px_rgba(28,176,246,0.45)]',
              ].join(' ')}
              role="presentation"
              aria-hidden
            >
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#1cb0f6] text-white text-lg">
                  📨
                </span>
                <div className="leading-tight">
                  <div className="font-display text-[#0369a1] font-bold text-sm">
                    Telegram
                  </div>
                  <div className="text-[var(--ink-3)] text-[10px] font-bold uppercase tracking-[0.15em]">
                    Ota-ona hisoboti
                  </div>
                </div>
              </div>
            </div>

            {/* Floating: mini lesson path (right side) */}
            <div
              className={[
                'drift-c absolute right-0 sm:-right-2 bottom-2 rotate-2',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[var(--brand)]/15',
                'px-4 py-3.5',
                'shadow-[0_18px_40px_-18px_rgba(109,40,217,0.45)]',
              ].join(' ')}
              role="presentation"
              aria-hidden
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ink-3)] mb-2.5">
                Yo&apos;l xaritasi
              </div>
              <div className="flex flex-col items-center gap-2.5">
                {/* Completed */}
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--success)] text-white shadow-[0_4px_0_0_#14532d]">
                  <Check size={18} strokeWidth={3.5} />
                </span>
                {/* Current */}
                <span className="relative grid place-items-center w-12 h-12 rounded-full bg-[var(--brand)] text-white shadow-[0_4px_0_0_var(--brand-deep)]">
                  <span
                    className="absolute inset-0 rounded-full bg-[var(--brand)]/40 motion-safe:[animation:pulse-ring_1.6s_ease-out_infinite]"
                    aria-hidden
                  />
                  <Check size={20} strokeWidth={3} />
                </span>
                {/* Locked */}
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[var(--surface-3)] text-[var(--ink-4)] shadow-inner">
                  <Lock size={14} strokeWidth={2.75} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
