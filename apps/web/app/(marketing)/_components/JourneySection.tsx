'use client';
import { ArrowRight } from 'lucide-react';

interface Props {
  onDemoClick: () => void;
}

const TOTAL = 500;
const COLS = 25;
// Every 50th step is a milestone
const MILESTONES = new Set([50, 100, 150, 200, 250, 300, 350, 400, 450, 500]);

type NodeKind = 'milestone-gold' | 'milestone-silver' | 'milestone-mini' | 'normal';

function nodeKind(n: number): NodeKind {
  if (!MILESTONES.has(n)) return 'normal';
  if (n === 500 || n === 450 || n === 400) return 'milestone-gold';
  if (n === 350 || n === 300 || n === 250 || n === 200) return 'milestone-silver';
  return 'milestone-mini';
}

const KIND_STYLES: Record<NodeKind, string> = {
  'milestone-gold':
    'w-5 h-5 rounded-full bg-[#fbbf24] shadow-[0_2px_0_0_#d97706] ring-2 ring-[#fbbf24]/40 text-white flex items-center justify-center',
  'milestone-silver':
    'w-5 h-5 rounded-full bg-[#6d28d9] shadow-[0_2px_0_0_#4c1d95] ring-2 ring-[#6d28d9]/30 text-white flex items-center justify-center',
  'milestone-mini':
    'w-5 h-5 rounded-full bg-[#f97316] shadow-[0_2px_0_0_#c2410c] ring-2 ring-[#f97316]/30 text-white flex items-center justify-center',
  normal: 'w-3.5 h-3.5 rounded-full bg-[#e8e0d0] ring-1 ring-[#d1c7bb]',
};

/** Build the 500-step grid as a flat array so we can render server-side. */
const NODES = Array.from({ length: TOTAL }, (_, i) => i + 1);

export function JourneySection({ onDemoClick }: Props) {
  return (
    <section
      id="journey"
      aria-labelledby="journey-h2"
      className="bg-white border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
            Gamifikatsiya
          </span>
          <h2
            id="journey-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            500 Qadamlik Sayohat
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            Har bir qadam yangi yutuq, har bir marra yangi imkoniyat!
          </p>
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-bold text-[#64748b]">
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#f97316]" aria-hidden />
            Mini Prize (50 qadam)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#6d28d9]" aria-hidden />
            Silver Prize (200 qadam)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#fbbf24]" aria-hidden />
            Gold Prize (400–500 qadam)
          </span>
        </div>

        {/* Step grid */}
        <div
          className="mt-10 overflow-x-auto"
          role="img"
          aria-label="500 bosqichli sayohat yo'li"
        >
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
              minWidth: '320px',
            }}
          >
            {NODES.map((n) => {
              const kind = nodeKind(n);
              const isMilestone = kind !== 'normal';

              return (
                <div
                  key={n}
                  title={isMilestone ? `${n}. qadam — Mukofot!` : `${n}. qadam`}
                  className={`${KIND_STYLES[kind]} transition-transform hover:scale-125`}
                >
                  {isMilestone && (
                    <span className="sr-only">{n}. qadam — Mukofot</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FINISH LINE banner */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-[#e8e0d0]" />
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#fbbf24] shadow-[0_4px_0_0_#d97706] text-white font-extrabold text-sm tracking-widest uppercase">
            <span aria-hidden>🏁</span>
            Finish Line
          </div>
          <div className="flex-1 h-px bg-[#e8e0d0]" />
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={onDemoClick}
            className="inline-flex items-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-base px-8 py-4 rounded-2xl shadow-[0_8px_0_0_#4c1d95] active:translate-y-[3px] active:shadow-[0_3px_0_0_#4c1d95] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
          >
            Hoziroq Boshlash
            <ArrowRight size={18} strokeWidth={2.75} />
          </button>
        </div>
      </div>
    </section>
  );
}
