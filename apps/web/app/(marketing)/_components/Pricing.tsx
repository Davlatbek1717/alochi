'use client';
import { Check, Star, ArrowRight } from 'lucide-react';

interface Tier {
  name: string;
  audience: string;
  features: string[];
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Boshlang'ich",
    audience: "Kichik markazlar (50 o'quvchigacha)",
    features: [
      'Cheksiz darslar',
      'AI savol-javob (Gemini)',
      'Telegram bot',
      'Multi-rol panel',
      'Real-time analytics',
    ],
  },
  {
    name: "O'sayotgan",
    audience: "O'rta markazlar (51–200 o'quvchi)",
    popular: true,
    features: [
      "Boshlang'ich rejaning hammasi",
      'Face ID davomat',
      'ClickHouse analytics',
      'Custom branding',
      'Prioritet yordam',
    ],
  },
  {
    name: 'Korxona',
    audience: "Yirik markazlar (200+ o'quvchi)",
    features: [
      "O'sayotgan rejaning hammasi",
      'Custom domeni',
      'SLA 99.99%',
      '24/7 yordam',
      'ML churn bashorati',
    ],
  },
];

interface Props {
  onDemoClick: () => void;
}

export function Pricing({ onDemoClick }: Props) {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-h2"
      className="relative bg-[var(--surface-2)] border-y border-[var(--line)] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex">
            <span className="section-eyebrow">Narxlar</span>
          </div>
          <h2
            id="pricing-h2"
            className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
          >
            Markazingiz uchun reja tanlang.
          </h2>
          <p className="mt-6 text-lg text-[var(--ink-2)] leading-relaxed">
            Aniq narx markaz hajmi va kerakli funksiyalarga qarab belgilanadi —
            biz bilan bog&apos;lanib individual taklif oling.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {TIERS.map((tier) => {
            const popular = !!tier.popular;
            return (
              <article
                key={tier.name}
                className={[
                  'relative flex flex-col rounded-3xl p-8',
                  'transition-all duration-300 ease-out',
                  popular
                    ? 'bg-[var(--surface)] border-2 border-[var(--brand)] shadow-[0_28px_60px_-28px_rgba(109,40,217,0.45)] lg:scale-[1.03] lg:-translate-y-1'
                    : 'bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-1)] hover:-translate-y-1 hover:shadow-[var(--shadow-3)] hover:border-[var(--line-strong)]',
                ].join(' ')}
              >
                {popular && (
                  <span
                    className={[
                      'absolute -top-3.5 left-1/2 -translate-x-1/2',
                      'inline-flex items-center gap-1.5',
                      'bg-[var(--brand)] text-white',
                      'text-[10px] font-extrabold uppercase tracking-[0.2em]',
                      'px-3.5 py-1.5 rounded-full',
                      'border-b-[3px] border-[var(--brand-deep)]',
                    ].join(' ')}
                  >
                    <Star
                      size={11}
                      strokeWidth={3}
                      fill="var(--accent)"
                      stroke="var(--accent)"
                    />
                    Eng mashhur
                  </span>
                )}

                <h3 className="font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                  {tier.name}
                </h3>
                <p className="mt-1.5 text-sm text-[var(--ink-3)]">
                  {tier.audience}
                </p>

                <div className="mt-7 pb-7 border-b border-[var(--line)]">
                  <span
                    className={[
                      'font-display text-3xl font-bold',
                      popular ? 'text-[var(--brand)]' : 'text-[var(--ink)]',
                    ].join(' ')}
                  >
                    Narxni so&apos;rang
                  </span>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-4)]">
                    Individual taklif
                  </p>
                </div>

                <ul className="mt-6 space-y-3 grow">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-[var(--ink)]"
                    >
                      <span
                        className="shrink-0 grid place-items-center w-5 h-5 rounded-full bg-[var(--success-soft)] text-[var(--success)] mt-0.5"
                        aria-hidden
                      >
                        <Check size={12} strokeWidth={3.5} />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={onDemoClick}
                  className={[
                    'group mt-8 inline-flex items-center justify-center gap-2',
                    'font-extrabold text-sm tracking-wide',
                    'px-5 py-3.5 rounded-xl',
                    'transition-all duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-2)]',
                    popular
                      ? 'bg-[var(--brand)] text-white border-b-[4px] border-[var(--brand-deep)] hover:bg-[var(--brand-strong)] active:translate-y-[2px] active:border-b-[1px] focus-visible:ring-[var(--brand)]'
                      : 'bg-[var(--ink)] text-white border-b-[4px] border-[#0a0717] hover:bg-[#2a2660] active:translate-y-[2px] active:border-b-[1px] focus-visible:ring-[var(--ink)]',
                  ].join(' ')}
                >
                  Tizimga kirish
                  <ArrowRight
                    size={16}
                    strokeWidth={2.75}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
