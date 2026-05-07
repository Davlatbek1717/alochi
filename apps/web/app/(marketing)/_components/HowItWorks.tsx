import { ArrowRight } from 'lucide-react';

const STEPS = [
  {
    n: 1,
    title: "Markaz qo'shiladi",
    body: "Superadmin yangi markaz yaratadi, filiallar va xodimlarga login beradi. Bu jarayon 15 daqiqada tugaydi.",
  },
  {
    n: 2,
    title: "O'quvchilar ro'yxatdan o'tadi",
    body: "Filadmin o'quvchilarni qo'shadi va ota-onalarga login va parol topshiradi. Telegram bot avtomatik ulanadi.",
  },
  {
    n: 3,
    title: 'Dars boshlanadi',
    body: "O'quvchi telefondan kiradi, AI savol-javob bilan ishlaydi, kamera nazorat qiladi, ota-ona Telegram orqali hisobot oladi.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-h2"
      className="relative bg-[var(--background)] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex">
            <span className="section-eyebrow">Jarayon</span>
          </div>
          <h2
            id="how-h2"
            className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
          >
            Qanday ishlaydi?
          </h2>
          <p className="mt-6 text-lg text-[var(--ink-2)] leading-relaxed">
            Uch qadam — markaz qo&apos;shilishidan ilk darsgacha bir kunda.
          </p>
        </div>

        <ol className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-6 relative">
          {STEPS.map((s, idx) => (
            <li
              key={s.n}
              className="relative flex flex-col items-center text-center px-2"
            >
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute inset-0 -m-3 rounded-full bg-[var(--brand)]/15 blur-2xl"
                />
                <span
                  className={[
                    'relative grid place-items-center w-24 h-24 rounded-full',
                    'font-display text-4xl font-bold text-white',
                    'shadow-[0_10px_0_0_var(--brand-deep)]',
                  ].join(' ')}
                  style={{
                    background:
                      'linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%)',
                  }}
                  aria-hidden
                >
                  {s.n}
                </span>
              </div>

              <h3 className="mt-8 font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                {s.title}
              </h3>
              <p className="mt-3 max-w-sm text-[15px] leading-[1.65] text-[var(--ink-2)]">
                {s.body}
              </p>

              {idx < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="hidden lg:flex absolute top-12 -right-6 text-[var(--brand)]/35"
                >
                  <ArrowRight size={40} strokeWidth={2.25} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
