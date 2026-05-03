import { Check, Award } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';

const BENEFITS = [
  'Bolangiz mustaqil o’qiydi (kamera nazorati bilan)',
  'Telegram orqali kunlik hisobot olasiz',
  'AI har o’quvchiga shaxsiy yondashadi',
  'Multi-rol tizim — markaz xodimlari va siz hamkorlikda',
];

export function ForParents() {
  return (
    <section
      aria-labelledby="parents-h2"
      className="bg-gradient-to-b from-[#fffaf0] to-[#fff7e6]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — visual */}
          <div className="relative h-[420px] sm:h-[460px] order-2 lg:order-1">
            {/* Soft halo */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-[#6d28d9]/12 blur-3xl"
            />

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Mascot expression="idle" size={220} animated />
            </div>

            {/* Telegram report tile */}
            <div
              className="drift-a absolute top-4 left-2 sm:left-6 -rotate-2 bg-white rounded-2xl border-2 border-[#1cb0f6]/30 px-4 py-3 shadow-lg flex items-center gap-2"
              aria-hidden
            >
              <span className="text-2xl">📊</span>
              <div>
                <div className="text-sm font-extrabold text-[#0369a1] leading-tight">
                  Telegram
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Kunlik hisobot
                </div>
              </div>
            </div>

            {/* Camera control tile */}
            <div
              className="drift-b absolute bottom-12 right-2 sm:right-6 rotate-2 bg-white rounded-2xl border-2 border-[#10b981]/25 px-4 py-3 shadow-lg flex items-center gap-2"
              aria-hidden
            >
              <span className="text-2xl">🎥</span>
              <div>
                <div className="text-sm font-extrabold text-[#0f766e] leading-tight">
                  Kamera
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Mustaqil ishlash
                </div>
              </div>
            </div>

            {/* Certificate tile */}
            <div
              className="drift-c absolute top-1/2 right-0 sm:right-2 -translate-y-1/2 rotate-3 bg-white rounded-2xl border-2 border-[#fbbf24]/40 px-4 py-3 shadow-lg flex items-center gap-2"
              aria-hidden
            >
              <span className="grid place-items-center w-9 h-9 rounded-full bg-[#fbbf24] text-white">
                <Award size={18} strokeWidth={2.75} />
              </span>
              <div>
                <div className="text-sm font-extrabold text-[#1e1b4b] leading-tight">
                  A2 Sertifikat
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Olindi
                </div>
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div className="order-1 lg:order-2">
            <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
              Ota-onalar uchun
            </span>
            <h2
              id="parents-h2"
              className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
            >
              Bolangiz uchun nima beradi?
            </h2>
            <p className="mt-4 text-lg text-[#475569] font-semibold">
              Bolaning vaqti behuda ketmasligi va ota-onaning bilib turishi — ikkalasi bir
              tizimda.
            </p>

            <ul className="mt-8 space-y-3.5">
              {BENEFITS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-base sm:text-lg font-semibold text-[#1e1b4b]"
                >
                  <span
                    className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-[#10b981] text-white shadow-[0_3px_0_0_#059669]"
                    aria-hidden
                  >
                    <Check size={15} strokeWidth={3.5} />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
