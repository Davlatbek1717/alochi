import { Brain, ScanFace, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

interface Card {
  title: string;
  body: string;
  icon: ReactNode;
  bg: string;
  ring: string;
}

const CARDS: Card[] = [
  {
    title: 'AI bilan o’qitish',
    body: 'Claude AI har o’quvchiga shaxsiy savol-javob beradi va xatolarni tushunarli til bilan tushuntiradi. Adaptiv qiyinlik tanlovi har bola darajasiga moslashadi.',
    icon: <Brain size={26} strokeWidth={2.5} />,
    bg: 'bg-[#6d28d9]',
    ring: 'ring-[#6d28d9]/20',
  },
  {
    title: 'Kamera nazorati',
    body: 'Akademiya topshiriqlari va imtihonlarda MediaPipe yuz aniqlash bola haqiqatan mustaqil ishlayotganini kafolatlaydi. Hech qanday rasm saqlanmaydi — faqat vaqtinchalik vektor.',
    icon: <ScanFace size={26} strokeWidth={2.5} />,
    bg: 'bg-[#f97316]',
    ring: 'ring-[#f97316]/20',
  },
  {
    title: 'Gamifikatsiya',
    body: '250 darslik zigzag yo’l xarita, XP, streak, 36 harf kolleksiyasi va virtual shahar — bola o’zi xohlab kuniga kiradi. O’yin ichida o’qitish — A’lochining o’zagidir.',
    icon: <Sparkles size={26} strokeWidth={2.5} />,
    bg: 'bg-[#fbbf24]',
    ring: 'ring-[#fbbf24]/30',
  },
];

export function WhyAlochi() {
  return (
    <section
      aria-labelledby="why-h2"
      className="bg-[#fffaf0]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#f97316]">
            Nega A&apos;lochi?
          </span>
          <h2
            id="why-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Boshqa platformalar bera olmaydigan uchta narsa.
          </h2>
          <p className="mt-4 text-lg text-[#475569] font-semibold">
            Boshqa LMS&apos;lar darslarni shunchaki video qilib qo&apos;yadi. A&apos;lochi —
            bola jalb qiluvchi, AI tushuntiruvchi, ota-ona xabardor bo&apos;lgan tirik tizim.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((card) => (
            <article
              key={card.title}
              className={`lift bg-white rounded-3xl p-7 border border-[#e8e0d0] ${card.ring} ring-1`}
            >
              <span
                className={`grid place-items-center w-14 h-14 rounded-2xl text-white ${card.bg} shadow-[0_8px_18px_-8px_rgba(15,23,42,0.35)]`}
              >
                {card.icon}
              </span>
              <h3 className="mt-5 text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                {card.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#475569] font-semibold">
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
