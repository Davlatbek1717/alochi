import { Brain, ScanFace, Send } from 'lucide-react';
import type { ReactNode } from 'react';

interface Card {
  title: string;
  body: string;
  icon: ReactNode;
  bg: string;
  glow: string;
  index: string;
}

const CARDS: Card[] = [
  {
    index: '01',
    title: "AI bilan o'qitish",
    body:
      "Google Gemini har o'quvchiga shaxsiy savol-javob beradi va xatolarni tushunarli til bilan tushuntiradi. Adaptiv qiyinlik har bola darajasiga moslashadi.",
    icon: <Brain size={28} strokeWidth={2.25} />,
    bg: 'bg-[var(--brand)]',
    glow: 'shadow-[0_18px_40px_-18px_rgba(109,40,217,0.55)]',
  },
  {
    index: '02',
    title: 'Kamera nazorati',
    body:
      "Akademiya topshiriqlari va imtihonlarda MediaPipe yuz aniqlash bola haqiqatan mustaqil ishlayotganini kafolatlaydi. Hech qanday rasm saqlanmaydi — faqat vaqtinchalik vektor.",
    icon: <ScanFace size={28} strokeWidth={2.25} />,
    bg: 'bg-[var(--accent)]',
    glow: 'shadow-[0_18px_40px_-18px_rgba(245,158,11,0.55)]',
  },
  {
    index: '03',
    title: 'Ota-onaga Telegram',
    body:
      "Kunlik faollik, dars natijalari va davomat haqida ota-onaga avtomatik xabarnoma — bola maktabda yoki uyda nima qilayotgani har kuni shaffof.",
    icon: <Send size={28} strokeWidth={2.25} />,
    bg: 'bg-[#1cb0f6]',
    glow: 'shadow-[0_18px_40px_-18px_rgba(28,176,246,0.55)]',
  },
];

export function WhyAlochi() {
  return (
    <section
      id="features"
      aria-labelledby="why-h2"
      className="relative bg-[var(--background)]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-3xl">
          <span className="section-eyebrow">Nega A&apos;lojon?</span>
          <h2
            id="why-h2"
            className={[
              'font-display mt-5',
              'text-4xl sm:text-5xl lg:text-6xl',
              'font-bold text-[var(--ink)]',
              'tracking-[-0.02em] leading-[1.05]',
            ].join(' ')}
          >
            Boshqa platformalar bera olmaydigan{' '}
            <span className="relative inline-block">
              <span className="relative z-10">uchta narsa</span>
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 right-0 h-3 bg-[var(--accent)]/45 -z-0 rounded-sm"
              />
            </span>
            .
          </h2>
          <p className="mt-6 text-lg text-[var(--ink-2)] leading-relaxed max-w-2xl">
            Boshqa LMS&apos;lar darslarni shunchaki video qilib qo&apos;yadi.
            A&apos;lojon — bola jalb qiluvchi, AI tushuntiruvchi, ota-ona
            xabardor bo&apos;lgan tirik tizim.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
          {CARDS.map((card) => (
            <article
              key={card.title}
              className={[
                'lift relative',
                'bg-[var(--surface)]',
                'rounded-3xl p-8',
                'border border-[var(--line)]',
                'overflow-hidden',
              ].join(' ')}
            >
              {/* Big background numeral as visual signature */}
              <span
                aria-hidden
                className="absolute -top-4 -right-2 font-display text-[140px] font-bold text-[var(--ink)]/[0.04] leading-none select-none pointer-events-none"
              >
                {card.index}
              </span>

              <div className="relative">
                <span
                  className={[
                    'grid place-items-center',
                    'w-16 h-16 rounded-2xl',
                    'text-white',
                    card.bg,
                    card.glow,
                  ].join(' ')}
                >
                  {card.icon}
                </span>

                <h3 className="mt-7 font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                  {card.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-[var(--ink-2)]">
                  {card.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
