import type { LandingCms } from './cms-types';

interface Props {
  cms: LandingCms['sponsors'] | null;
}

const STATIC_SPONSORS = [
  {
    emoji: '🏰',
    name: 'Buxoro Travel',
    tagline: "Buyuk ipak yoʻlining markaziga sayohat",
  },
  {
    emoji: '🕌',
    name: 'Samarqand Travel',
    tagline: 'Registon maydoni va tarixiy obidalar',
  },
  {
    emoji: '🏺',
    name: 'Xiva Travel',
    tagline: "Ichon-Qalʼa — jonli muzey shahri",
  },
];

export function TravelSection({ cms }: Props) {
  const title = cms?.title || 'Sayohat homiylari';
  const subtitle = cms?.subtitle || "Eng zoʻr oʻquvchilarga ekskursiya yoʻllanmalari";
  const items = cms?.items ?? [];

  return (
    <section
      id="travel"
      aria-labelledby="travel-h2"
      className="bg-white border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
            Hamkorlar
          </span>
          <h2
            id="travel-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            {title}
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Sponsor cards */}
        {items.length > 0 ? (
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {items.map((item) => {
              const emoji = item.meta?.emoji ?? '🏙️';
              const city = item.meta?.city ?? '';
              return (
                <article
                  key={item.id}
                  className="lift bg-[#fffaf0] rounded-2xl border-2 border-[#e8e0d0] p-8 flex flex-col items-center text-center"
                >
                  <div className="text-5xl mb-4" aria-hidden>{emoji}</div>
                  <h3 className="text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                    {item.title}
                  </h3>
                  {(item.description || city) && (
                    <p className="mt-2 text-sm font-semibold text-[#64748b] leading-relaxed">
                      {item.description ?? city}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STATIC_SPONSORS.map((s) => (
              <article
                key={s.name}
                className="lift bg-[#fffaf0] rounded-2xl border-2 border-[#e8e0d0] p-8 flex flex-col items-center text-center"
              >
                <div className="text-5xl mb-4" aria-hidden>{s.emoji}</div>
                <h3 className="text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                  {s.name}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[#64748b] leading-relaxed">
                  {s.tagline}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
