'use client';
import { ArrowRight } from 'lucide-react';
import { Mascot } from '@/components/ui/Mascot';

interface Props {
  onDemoClick: () => void;
}

export function CTA({ onDemoClick }: Props) {
  return (
    <section
      aria-labelledby="cta-h2"
      className="relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #6d28d9 0%, #5b21b6 45%, #1e1b4b 100%)',
      }}
    >
      {/* Decorative orange wash */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(35% 60% at 90% 20%, rgba(249,115,22,0.55) 0%, rgba(249,115,22,0) 60%), radial-gradient(35% 60% at 10% 80%, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0) 60%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="relative bg-[#fffaf0] rounded-3xl border border-[#fbbf24]/30 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.6)] px-6 py-12 sm:px-12 sm:py-16 lg:py-20 overflow-hidden">
          {/* Mascot peeking — desktop only */}
          <div className="hidden lg:block absolute -right-2 bottom-0 pointer-events-none" aria-hidden>
            <Mascot expression="happy" size={220} animated />
          </div>

          <div className="max-w-2xl relative">
            <span className="inline-block text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
              Keyingi qadam
            </span>
            <h2
              id="cta-h2"
              className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight"
            >
              Markazingizni keyingi avlod platformasiga oling.
            </h2>
            <p className="mt-5 text-lg text-[#475569] font-semibold">
              Demo so&apos;rang — bizning jamoa siz bilan 24 soat ichida bog&apos;lanadi va
              platformani 30 daqiqada to&apos;liq ko&apos;rsatadi.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onDemoClick}
                className="inline-flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-base px-7 py-4 rounded-2xl shadow-[0_8px_0_0_#4c1d95] active:translate-y-[3px] active:shadow-[0_3px_0_0_#4c1d95] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
              >
                Demo so&apos;rash
                <ArrowRight size={18} strokeWidth={2.75} />
              </button>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#1e1b4b] font-extrabold text-base px-6 py-4 rounded-2xl border-2 border-[#1e1b4b]/12 hover:border-[#6d28d9]/30 transition-all"
              >
                Imkoniyatlarni ko&apos;rish
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
