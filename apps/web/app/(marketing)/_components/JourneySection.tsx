'use client';
import { ArrowRight } from 'lucide-react';
import type { LandingCms, MilestoneTier } from './cms-types';

interface Props {
  onDemoClick: () => void;
  cms: LandingCms['journey'] | null;
}

const FALLBACK = {
  badge: 'Gamifikatsiya',
  title: '500 Qadamlik Sayohat',
  subtitle: 'Har bir qadam yangi yutuq, har bir marra yangi imkoniyat!',
  cta: 'Hoziroq Boshlash',
  totalSteps: 500,
  cols: 25,
  legend: {
    mini: 'Mini Prize (50 qadam)',
    silver: 'Silver Prize (200 qadam)',
    gold: 'Gold Prize (400–500 qadam)',
  },
  milestones: [
    { step: 50, tier: 'mini' as MilestoneTier, label: 'Mini Prize' },
    { step: 100, tier: 'mini' as MilestoneTier, label: 'Mini Prize' },
    { step: 150, tier: 'mini' as MilestoneTier, label: 'Mini Prize' },
    { step: 200, tier: 'silver' as MilestoneTier, label: 'Silver Prize' },
    { step: 250, tier: 'silver' as MilestoneTier, label: 'Silver Prize' },
    { step: 300, tier: 'silver' as MilestoneTier, label: 'Silver Prize' },
    { step: 350, tier: 'silver' as MilestoneTier, label: 'Silver Prize' },
    { step: 400, tier: 'gold' as MilestoneTier, label: 'Gold Prize' },
    { step: 450, tier: 'gold' as MilestoneTier, label: 'Gold Prize' },
    { step: 500, tier: 'gold' as MilestoneTier, label: 'Gold Prize' },
  ],
};

type NodeKind = 'milestone-gold' | 'milestone-silver' | 'milestone-mini' | 'normal';

const KIND_STYLES: Record<NodeKind, string> = {
  'milestone-gold':
    'w-5 h-5 rounded-full bg-[#fbbf24] shadow-[0_2px_0_0_#d97706] ring-2 ring-[#fbbf24]/40 text-white flex items-center justify-center',
  'milestone-silver':
    'w-5 h-5 rounded-full bg-[#6d28d9] shadow-[0_2px_0_0_#4c1d95] ring-2 ring-[#6d28d9]/30 text-white flex items-center justify-center',
  'milestone-mini':
    'w-5 h-5 rounded-full bg-[#f97316] shadow-[0_2px_0_0_#c2410c] ring-2 ring-[#f97316]/30 text-white flex items-center justify-center',
  normal: 'w-3.5 h-3.5 rounded-full bg-[#e8e0d0] ring-1 ring-[#d1c7bb]',
};

export function JourneySection({ onDemoClick, cms }: Props) {
  const data = cms ?? FALLBACK;
  // Lookup map: step → tier. Built once per render so dot rendering
  // stays O(N) instead of O(N·M).
  const tierByStep = new Map<number, MilestoneTier>();
  for (const m of data.milestones) tierByStep.set(m.step, m.tier);

  function nodeKind(n: number): NodeKind {
    const tier = tierByStep.get(n);
    if (!tier) return 'normal';
    if (tier === 'gold') return 'milestone-gold';
    if (tier === 'silver') return 'milestone-silver';
    return 'milestone-mini';
  }

  const nodes = Array.from({ length: data.totalSteps }, (_, i) => i + 1);

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
            {data.badge}
          </span>
          <h2
            id="journey-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            {data.title}
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            {data.subtitle}
          </p>
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-bold text-[#64748b]">
          {data.legend.mini && (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#f97316]" aria-hidden />
              {data.legend.mini}
            </span>
          )}
          {data.legend.silver && (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#6d28d9]" aria-hidden />
              {data.legend.silver}
            </span>
          )}
          {data.legend.gold && (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-[#fbbf24]" aria-hidden />
              {data.legend.gold}
            </span>
          )}
        </div>

        {/* Step grid */}
        <div
          className="mt-10 overflow-x-auto"
          role="img"
          aria-label={`${data.totalSteps} bosqichli sayohat yo'li`}
        >
          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))`,
              minWidth: '320px',
            }}
          >
            {nodes.map((n) => {
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
            {data.cta}
            <ArrowRight size={18} strokeWidth={2.75} />
          </button>
        </div>
      </div>
    </section>
  );
}
