'use client';
import { Check, Star } from 'lucide-react';

interface Tier {
  name: string;
  audience: string;
  features: string[];
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Boshlang’ich",
    audience: 'Kichik markazlar (50 o’quvchigacha)',
    features: [
      'Cheksiz darslar',
      'AI savol-javob (Claude)',
      'Telegram bot',
      'Multi-rol panel',
      'Real-time analytics',
    ],
  },
  {
    name: "O’sayotgan",
    audience: 'O’rta markazlar (51–200 o’quvchi)',
    popular: true,
    features: [
      'Boshlang’ich rejaning hammasi',
      'Face ID davomat',
      'ClickHouse analytics',
      'Custom branding',
      'Prioritet yordam',
    ],
  },
  {
    name: 'Korxona',
    audience: 'Yirik markazlar (200+ o’quvchi)',
    features: [
      'O’sayotgan rejaning hammasi',
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
      className="bg-white border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
            Narxlar
          </span>
          <h2
            id="pricing-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Markazingiz uchun reja tanlang.
          </h2>
          <p className="mt-4 text-lg text-[#475569] font-semibold">
            Aniq narx markaz hajmi va kerakli funksiyalarga qarab belgilanadi —
            biz bilan bog&apos;lanib individual taklif oling.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {TIERS.map((tier) => {
            const popular = !!tier.popular;
            return (
              <article
                key={tier.name}
                className={[
                  'relative flex flex-col rounded-3xl p-7 transition-transform',
                  popular
                    ? 'bg-white border-2 border-[#6d28d9] shadow-[0_24px_60px_-24px_rgba(109,40,217,0.45)] lg:scale-[1.03]'
                    : 'bg-white border border-[#e8e0d0] shadow-sm',
                ].join(' ')}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-[#6d28d9] text-white text-[11px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_4px_0_0_#4c1d95]">
                    <Star size={12} strokeWidth={3} fill="#fbbf24" stroke="#fbbf24" />
                    Eng mashhur
                  </span>
                )}

                <h3 className="text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                  {tier.name}
                </h3>
                <p className="mt-1.5 text-sm font-semibold text-[#64748b]">
                  {tier.audience}
                </p>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#6d28d9]">
                    Narxni so&apos;rang
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#64748b]">
                  Individual taklif
                </p>

                <ul className="mt-6 space-y-2.5 grow">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm font-semibold text-[#1e1b4b]"
                    >
                      <span
                        className="shrink-0 grid place-items-center w-5 h-5 rounded-full bg-[#10b981]/15 text-[#10b981] mt-0.5"
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
                    'mt-7 inline-flex items-center justify-center gap-2 font-extrabold text-sm px-5 py-3.5 rounded-xl transition-all',
                    popular
                      ? 'bg-[#6d28d9] hover:bg-[#5b21b6] text-white shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95]'
                      : 'bg-[#1e1b4b] hover:bg-[#0f172a] text-white shadow-[0_6px_0_0_#0a0f1f] active:translate-y-[2px] active:shadow-[0_2px_0_0_#0a0f1f]',
                  ].join(' ')}
                >
                  Aloqaga chiqish
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
