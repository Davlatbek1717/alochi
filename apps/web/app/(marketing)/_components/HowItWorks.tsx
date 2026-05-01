import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    n: 1,
    title: 'Markaz qo’shiladi',
    body: 'Superadmin yangi markaz yaratadi, filiallar va xodimlarga login beradi. Bu jarayon 15 daqiqada tugaydi.',
  },
  {
    n: 2,
    title: 'O’quvchilar ro’yxatdan o’tadi',
    body: 'Filadmin o’quvchilarni qo’shadi va ota-onalarga login va parol topshiradi. Telegram bot avtomatik ulanadi.',
  },
  {
    n: 3,
    title: 'Dars boshlanadi',
    body: 'O’quvchi telefondan kiradi, AI savol-javob bilan ishlaydi, kamera nazorat qiladi, ota-ona Telegram orqali hisobot oladi.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-h2"
      className="bg-white border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
            Jarayon
          </span>
          <h2
            id="how-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Qanday ishlaydi?
          </h2>
          <p className="mt-4 text-lg text-[#475569] font-semibold">
            Uch qadam — markaz qo&apos;shilishidan ilk darsgacha bir kunda.
          </p>
        </div>

        <ol className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-4 relative">
          {STEPS.map((s, idx) => (
            <li key={s.n} className="relative flex flex-col items-center text-center px-2">
              {/* Number bubble with brand gradient */}
              <span
                className="grid place-items-center w-20 h-20 rounded-full text-white text-3xl font-extrabold shadow-[0_10px_0_0_#4c1d95]"
                style={{
                  background: 'linear-gradient(135deg, #6d28d9 0%, #f97316 100%)',
                }}
                aria-hidden
              >
                {s.n}
              </span>

              <h3 className="mt-6 text-xl font-extrabold text-[#1e1b4b] tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[#475569] font-semibold">
                {s.body}
              </p>

              {/* Arrow connector — desktop only, between steps */}
              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="hidden lg:flex absolute top-10 -right-4 text-[#6d28d9]/40"
                >
                  <ArrowRight size={36} strokeWidth={2.5} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
