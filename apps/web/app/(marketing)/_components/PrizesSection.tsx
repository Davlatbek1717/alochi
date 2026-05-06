import type { LandingCms } from './cms-types';

// Accent palette cycles through these for CMS items
const ACCENTS = [
  {
    bg: 'bg-[#fff7ed]',
    fg: 'text-[#f97316]',
    border: 'border-[#f97316]/25',
    badge: 'bg-[#f97316] text-white',
  },
  {
    bg: 'bg-[#f5f3ff]',
    fg: 'text-[#6d28d9]',
    border: 'border-[#6d28d9]/25',
    badge: 'bg-[#6d28d9] text-white',
  },
  {
    bg: 'bg-[#fffbeb]',
    fg: 'text-[#d97706]',
    border: 'border-[#fbbf24]/35',
    badge: 'bg-[#fbbf24] text-[#1e1b4b]',
  },
];

interface Props {
  cms: LandingCms['prizes'] | null;
}

export function PrizesSection({ cms }: Props) {
  const title = cms?.title || 'Yutuqlar uchun mukofotlar';
  const subtitle = cms?.subtitle || 'Har bir bosqichni tugatganda real sovgʼalar va imtiyozlar kutadi.';
  const items = cms?.items ?? [];

  // Fall back to static prizes when API returns no items
  const staticPrizes = [
    {
      id: 'static-1',
      emoji: '🎁',
      tier: 'Mini Prize',
      lessonCount: 50,
      description: "Maxsus sovgʼa — birinchi katta qadamingiz uchun tabriklash paketi.",
    },
    {
      id: 'static-2',
      emoji: '🥈',
      tier: 'Silver Prize',
      lessonCount: 200,
      description: "Yillik abonement — platformada barcha qoʼshimcha kontent va sessiyalar.",
    },
    {
      id: 'static-3',
      emoji: '🏆',
      tier: 'Good Prize',
      lessonCount: 500,
      description: "Ekskursiya yoʻllanmasi — Oʻzbekistonning tarixi shahriga bepul sayohat.",
    },
  ];

  return (
    <section
      id="prizes"
      aria-labelledby="prizes-h2"
      className="bg-[#fffaf0] border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
            Motivatsiya
          </span>
          <h2
            id="prizes-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            {title}
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Prize cards */}
        {items.length > 0 ? (
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {items.map((item, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const icon = item.meta?.icon ?? '🎁';
              const lessonCount = item.meta?.lessonCount ?? '';
              return (
                <article
                  key={item.id}
                  className={`lift rounded-2xl border-2 p-6 flex flex-col items-center text-center ${accent.bg} ${accent.border}`}
                >
                  <div className="text-6xl mb-4" aria-hidden>{icon}</div>
                  {lessonCount && (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest mb-3 ${accent.badge}`}
                    >
                      {lessonCount} dars
                    </span>
                  )}
                  <h3 className={`text-xl font-extrabold tracking-tight ${accent.fg}`}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-3 text-sm font-semibold text-[#475569] leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {staticPrizes.map((prize, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              return (
                <article
                  key={prize.id}
                  className={`lift rounded-2xl border-2 p-6 flex flex-col items-center text-center ${accent.bg} ${accent.border}`}
                >
                  <div className="text-6xl mb-4" aria-hidden>{prize.emoji}</div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest mb-3 ${accent.badge}`}
                  >
                    {prize.lessonCount} dars
                  </span>
                  <h3 className={`text-xl font-extrabold tracking-tight ${accent.fg}`}>
                    {prize.tier}
                  </h3>
                  <p className="mt-3 text-sm font-semibold text-[#475569] leading-relaxed">
                    {prize.description}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
