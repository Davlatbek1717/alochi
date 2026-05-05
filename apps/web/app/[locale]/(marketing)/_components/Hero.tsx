'use client';
import { ArrowRight, Play, Check, Lock } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';
import type { LandingCms } from './cms-types';

interface Props {
  onDemoClick: () => void;
  cms: LandingCms['hero'] | null;
}

export function Hero({ onDemoClick, cms }: Props) {
  const badge = cms?.badge || "Oʻzbekiston taʻlim platformasi";
  const title = cms?.title || "Bolangizning muvaffaqiyat yoʻli shu yerdan boshlanadi.";
  const subtitle =
    cms?.subtitle ||
    "3–7 sinf oʻquvchilari uchun ingliz tili, shaxsiy rivojlanish va tanqidiy fikrlashni oʻrgatuvchi zamonaviy SaaS platforma. AI suhbatlar, kamera nazorati va ota-onalar uchun Telegram hisobotlar.";
  const cta = cms?.cta || "Markaz sifatida ulanish";

  return (
    <section
      aria-labelledby="hero-h1"
      className="relative overflow-hidden hero-glow"
    >
      {/* Decorative grid mask */}
      <div className="pointer-events-none absolute inset-0 grid-mask" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 lg:pt-20 pb-16 lg:pb-24">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-12 items-center">
          {/* LEFT — copy (60%) */}
          <div className="lg:col-span-3 motion-safe:[animation:bounce-in_550ms_ease-out]">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6d28d9]/10 border border-[#6d28d9]/20 text-[#6d28d9] text-xs font-extrabold uppercase tracking-widest">
              <span aria-hidden>🇺🇿</span>
              {badge}
            </span>

            <h1
              id="hero-h1"
              className="mt-5 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-[#1e1b4b] leading-[1.05] tracking-tight"
            >
              {title}
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-[#475569] font-semibold max-w-[560px] leading-relaxed">
              {subtitle}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-base px-6 py-4 rounded-2xl shadow-[0_8px_0_0_#4c1d95] active:translate-y-[3px] active:shadow-[0_3px_0_0_#4c1d95] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
              >
                Bepul boshlash
                <ArrowRight size={18} strokeWidth={2.75} />
              </a>
              <button
                type="button"
                onClick={onDemoClick}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-white/80 text-[#1e1b4b] font-extrabold text-base px-6 py-4 rounded-2xl border-2 border-[#1e1b4b]/12 hover:border-[#6d28d9]/30 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
              >
                <Play size={18} strokeWidth={2.75} className="text-[#6d28d9] fill-[#6d28d9]" />
                {cta}
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm font-bold text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} strokeWidth={3} className="text-[#10b981]" />
                PDPL talablariga mos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} strokeWidth={3} className="text-[#10b981]" />
                Multi-tenant SaaS
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check size={14} strokeWidth={3} className="text-[#10b981]" />
                99.9% uptime
              </span>
            </div>
          </div>

          {/* RIGHT — mascot + floating UI (40%) */}
          <div className="lg:col-span-2 relative h-[420px] sm:h-[480px] lg:h-[540px]">
            {/* Soft halo behind mascot */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-[#f97316]/15 blur-3xl"
              aria-hidden
            />

            {/* Mascot center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Mascot expression="happy" size={260} animated />
            </div>

            {/* Floating: AI tutor card (top-right) */}
            <div
              className="drift-a absolute top-6 right-2 sm:right-6 rotate-3 bg-white rounded-2xl border-2 border-[#6d28d9]/20 px-4 py-3 shadow-[0_12px_30px_-12px_rgba(109,40,217,0.4)]"
              role="presentation"
              aria-hidden
            >
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#6d28d9] text-white">
                  <Check size={18} strokeWidth={3} />
                </span>
                <div className="leading-tight">
                  <div className="text-[#1e1b4b] font-extrabold text-sm">AI tutor</div>
                  <div className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                    Shaxsiy yondashuv
                  </div>
                </div>
              </div>
            </div>

            {/* Floating: parent report (bottom-left) */}
            <div
              className="drift-b absolute bottom-10 left-0 sm:left-2 -rotate-3 bg-white rounded-2xl border-2 border-[#1cb0f6]/30 px-4 py-3 shadow-[0_12px_30px_-12px_rgba(28,176,246,0.4)]"
              role="presentation"
              aria-hidden
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <div className="leading-tight">
                  <div className="text-[#0369a1] font-extrabold text-sm">Telegram</div>
                  <div className="text-[#64748b] text-[11px] font-bold uppercase tracking-wider">
                    Ota-ona hisoboti
                  </div>
                </div>
              </div>
            </div>

            {/* Floating: mini lesson path (right side) */}
            <div
              className="drift-c absolute right-0 sm:-right-2 bottom-2 rotate-2 bg-white rounded-2xl border-2 border-[#6d28d9]/15 px-4 py-3 shadow-[0_12px_30px_-12px_rgba(109,40,217,0.4)]"
              role="presentation"
              aria-hidden
            >
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b] mb-2">
                Yo&apos;l xaritasi
              </div>
              <div className="flex flex-col items-center gap-2">
                {/* Completed */}
                <span className="grid place-items-center w-10 h-10 rounded-full bg-[#10b981] text-white shadow-[0_4px_0_0_#059669]">
                  <Check size={18} strokeWidth={3.5} />
                </span>
                {/* Current */}
                <span className="relative grid place-items-center w-12 h-12 rounded-full bg-[#6d28d9] text-white shadow-[0_4px_0_0_#4c1d95]">
                  <span
                    className="absolute inset-0 rounded-full bg-[#6d28d9]/40 motion-safe:[animation:pulse-ring_1.6s_ease-out_infinite]"
                    aria-hidden
                  />
                  <Check size={20} strokeWidth={3} />
                </span>
                {/* Locked */}
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#e8e0d0] text-[#94a3b8] shadow-inner">
                  <Lock size={14} strokeWidth={2.75} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
