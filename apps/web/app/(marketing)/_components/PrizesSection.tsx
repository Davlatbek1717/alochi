interface Prize {
  emoji: string;
  tier: string;
  threshold: number;
  description: string;
  accent: { bg: string; fg: string; border: string; shadow: string; badge: string };
}

const PRIZES: Prize[] = [
  {
    emoji: '🎁',
    tier: 'Mini Prize',
    threshold: 50,
    description: "Maxsus sovg'a — birinchi katta qadamingiz uchun tabriklash paketi.",
    accent: {
      bg: 'bg-[#fff7ed]',
      fg: 'text-[#f97316]',
      border: 'border-[#f97316]/25',
      shadow: 'shadow-[0_8px_0_0_#c2410c]',
      badge: 'bg-[#f97316] text-white',
    },
  },
  {
    emoji: '🥈',
    tier: 'Silver Prize',
    threshold: 200,
    description: "Yillik abonement — platformada barcha qo'shimcha kontent va sessiyalar.",
    accent: {
      bg: 'bg-[#f5f3ff]',
      fg: 'text-[#6d28d9]',
      border: 'border-[#6d28d9]/25',
      shadow: 'shadow-[0_8px_0_0_#4c1d95]',
      badge: 'bg-[#6d28d9] text-white',
    },
  },
  {
    emoji: '🏆',
    tier: 'Good Prize',
    threshold: 500,
    description: "Ekskursiya yo'llanmasi — O'zbekistonning tarixi shahriga bepul sayohat.",
    accent: {
      bg: 'bg-[#fffbeb]',
      fg: 'text-[#d97706]',
      border: 'border-[#fbbf24]/35',
      shadow: 'shadow-[0_8px_0_0_#b45309]',
      badge: 'bg-[#fbbf24] text-[#1e1b4b]',
    },
  },
];

export function PrizesSection() {
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
            Yutuqlar uchun mukofotlar
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            Har bir bosqichni tugatganda real sovg&apos;alar va imtiyozlar kutadi.
          </p>
        </div>

        {/* Prize cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PRIZES.map((prize) => (
            <article
              key={prize.tier}
              className={`lift rounded-2xl border-2 p-6 flex flex-col items-center text-center ${prize.accent.bg} ${prize.accent.border}`}
            >
              {/* Emoji badge */}
              <div className="text-6xl mb-4" aria-hidden>
                {prize.emoji}
              </div>

              {/* Threshold chip */}
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest mb-3 ${prize.accent.badge}`}
              >
                {prize.threshold} dars
              </span>

              <h3
                className={`text-xl font-extrabold tracking-tight ${prize.accent.fg}`}
              >
                {prize.tier}
              </h3>

              <p className="mt-3 text-sm font-semibold text-[#475569] leading-relaxed">
                {prize.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
