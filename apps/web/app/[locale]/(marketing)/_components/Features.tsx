import {
  Brain,
  Map,
  Activity,
  Users,
  ScanFace,
  MessageCircle,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface Feature {
  title: string;
  body: string;
  icon: ReactNode;
  tone: 'violet' | 'orange' | 'green' | 'blue' | 'gold' | 'pink' | 'navy';
}

const TONES: Record<Feature['tone'], { bg: string; fg: string; border: string }> = {
  violet: { bg: 'bg-[#6d28d9]/10', fg: 'text-[#6d28d9]', border: 'border-[#6d28d9]/20' },
  orange: { bg: 'bg-[#f97316]/12', fg: 'text-[#f97316]', border: 'border-[#f97316]/25' },
  green: { bg: 'bg-[#10b981]/12', fg: 'text-[#10b981]', border: 'border-[#10b981]/25' },
  blue: { bg: 'bg-[#1cb0f6]/12', fg: 'text-[#1cb0f6]', border: 'border-[#1cb0f6]/25' },
  gold: { bg: 'bg-[#fbbf24]/15', fg: 'text-[#d97706]', border: 'border-[#fbbf24]/30' },
  pink: { bg: 'bg-[#ce82ff]/15', fg: 'text-[#a855f7]', border: 'border-[#ce82ff]/30' },
  navy: { bg: 'bg-[#1e1b4b]/8', fg: 'text-[#1e1b4b]', border: 'border-[#1e1b4b]/15' },
};

const FEATURES: Feature[] = [
  {
    title: 'Adaptiv qiyinlik',
    body: 'N-back asosida har o’quvchining darajasiga moslashadi va zerikishni oldini oladi.',
    icon: <Brain size={22} strokeWidth={2.5} />,
    tone: 'violet',
  },
  {
    title: 'Yo’l xaritasi',
    body: '250 dars darajama-daraja tartibda — har bir bosqich avvalgisi ustiga quriladi.',
    icon: <Map size={22} strokeWidth={2.5} />,
    tone: 'orange',
  },
  {
    title: 'Real-time statuslar',
    body: 'Yashil / Sariq / Qizil — Mentor, Manager va Filadmin har soniyada bilib turadi.',
    icon: <Activity size={22} strokeWidth={2.5} />,
    tone: 'green',
  },
  {
    title: 'Sotsial xususiyatlar',
    body: 'Lenta, do’stlar, duel, group challenges — bola jamoadosh bilan birga o’sadi.',
    icon: <Users size={22} strokeWidth={2.5} />,
    tone: 'blue',
  },
  {
    title: 'Face ID davomat',
    body: 'PDPL-mos: faqat 128 o’lchovli vektor saqlanadi, AES-256 bilan shifrlanadi.',
    icon: <ScanFace size={22} strokeWidth={2.5} />,
    tone: 'pink',
  },
  {
    title: 'Telegram bot',
    body: 'Ota-onalarga kunlik hisobot, davomat ogohlantirishi va to’lov eslatmalari.',
    icon: <MessageCircle size={22} strokeWidth={2.5} />,
    tone: 'gold',
  },
  {
    title: 'Analitika',
    body: '8 tablik dashboard, ClickHouse asosida real-time, ML churn bashorati bilan.',
    icon: <BarChart3 size={22} strokeWidth={2.5} />,
    tone: 'violet',
  },
  {
    title: 'PWA',
    body: 'Telefonga o’rnatish, offline rejimi, push-bildirishnoma — App Store kerak emas.',
    icon: <Smartphone size={22} strokeWidth={2.5} />,
    tone: 'navy',
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-h2"
      className="bg-white border-t border-b border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
              Hamma narsa bitta joyda
            </span>
            <h2
              id="features-h2"
              className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
            >
              Imkoniyatlar
            </h2>
          </div>
          <p className="text-base text-[#475569] font-semibold max-w-md">
            O&apos;quvchidan superadminacha — har bir rolga zarur asboblar yagona kod bazasida.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => {
            const tone = TONES[f.tone];
            return (
              <article
                key={f.title}
                className={`lift bg-white rounded-2xl p-5 border-2 ${tone.border}`}
              >
                <span
                  className={`grid place-items-center w-11 h-11 rounded-xl ${tone.bg} ${tone.fg}`}
                  aria-hidden
                >
                  {f.icon}
                </span>
                <h3 className="mt-4 text-base font-extrabold text-[#1e1b4b]">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#475569] font-semibold">
                  {f.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
