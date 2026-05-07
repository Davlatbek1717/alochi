import { Check, Award } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';

const BENEFITS = [
  "Bolangiz mustaqil o'qiydi (kamera nazorati bilan)",
  'Telegram orqali kunlik hisobot olasiz',
  "AI har o'quvchiga shaxsiy yondashadi",
  'Multi-rol tizim — markaz xodimlari va siz hamkorlikda',
];

export function ForParents() {
  return (
    <section
      aria-labelledby="parents-h2"
      className="relative bg-gradient-to-b from-[var(--background)] to-[var(--surface-2)]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          {/* Left — visual */}
          <div className="relative h-[440px] sm:h-[500px] order-2 lg:order-1">
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full bg-[var(--brand)]/15 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute left-[35%] top-[55%] -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full bg-[var(--accent)]/12 blur-3xl"
            />

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Mascot expression="idle" size={240} animated />
            </div>

            {/* Telegram tile */}
            <div
              className={[
                'drift-a absolute top-4 left-2 sm:left-6 -rotate-2',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[#1cb0f6]/30',
                'px-4 py-3.5',
                'shadow-[0_18px_40px_-18px_rgba(28,176,246,0.45)]',
                'flex items-center gap-3',
              ].join(' ')}
              aria-hidden
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#1cb0f6] text-white text-lg">
                📊
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-bold text-[#0369a1]">
                  Telegram
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--ink-3)]">
                  Kunlik hisobot
                </div>
              </div>
            </div>

            {/* Camera tile */}
            <div
              className={[
                'drift-b absolute bottom-14 right-2 sm:right-6 rotate-2',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[var(--success)]/30',
                'px-4 py-3.5',
                'shadow-[0_18px_40px_-18px_rgba(21,128,61,0.45)]',
                'flex items-center gap-3',
              ].join(' ')}
              aria-hidden
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--success)] text-white text-lg">
                🎥
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-bold text-[var(--success)]">
                  Kamera
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--ink-3)]">
                  Mustaqil ishlash
                </div>
              </div>
            </div>

            {/* Certificate tile */}
            <div
              className={[
                'drift-c absolute top-1/2 right-0 sm:right-2 -translate-y-1/2 rotate-3',
                'bg-[var(--surface)] rounded-2xl',
                'border border-[var(--accent)]/35',
                'px-4 py-3.5',
                'shadow-[0_18px_40px_-18px_rgba(245,158,11,0.45)]',
                'flex items-center gap-3',
              ].join(' ')}
              aria-hidden
            >
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--accent)] text-white">
                <Award size={18} strokeWidth={2.5} />
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-bold text-[var(--ink)]">
                  A2 Sertifikat
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--ink-3)]">
                  Olindi
                </div>
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div className="order-1 lg:order-2">
            <span className="section-eyebrow">Ota-onalar uchun</span>
            <h2
              id="parents-h2"
              className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
            >
              Bolangiz uchun{' '}
              <span className="italic font-medium text-[var(--brand)]">
                nima beradi?
              </span>
            </h2>
            <p className="mt-6 text-lg text-[var(--ink-2)] leading-relaxed max-w-lg">
              Bolaning vaqti behuda ketmasligi va ota-onaning bilib turishi —
              ikkalasi bir tizimda.
            </p>

            <ul className="mt-10 space-y-4">
              {BENEFITS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3.5 text-base sm:text-lg text-[var(--ink)]"
                >
                  <span
                    className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-[var(--success)] text-white shadow-[0_3px_0_0_#14532d]"
                    aria-hidden
                  >
                    <Check size={15} strokeWidth={3.5} />
                  </span>
                  <span className="leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
