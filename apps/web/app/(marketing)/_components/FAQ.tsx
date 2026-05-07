import { ChevronDown } from 'lucide-react';

const QA = [
  {
    q: 'Tizim qaysi qurilmalarda ishlaydi?',
    a: "A'lochi PWA sifatida har qanday smartfon (iOS, Android), planshet va kompyuterda ishlaydi. Bola asosan telefonidan kiradi — tezda yuklanadi va offline rejimda ham asosiy darslarni ochadi.",
  },
  {
    q: "O'quvchining ma'lumotlari xavfsizmi?",
    a: "Ha. Biz O'zbekiston PDPL talablariga to'liq mosmiz. Yuz vektorlari faqat 128 o'lchovli son shaklida, AES-256 bilan shifrlangan holda saqlanadi — hech qanday rasm yoki video saqlanmaydi. Ma'lumotlar xosting markazi O'zbekiston hududida.",
  },
  {
    q: 'AI suhbat qancha turadi?',
    a: "Google Gemini har bir o'quvchiga shaxsiy javob beradi va xato tahlilini bera oladi. AI ishlatilishi tanlangan rejaga kiritilgan — alohida hisob talab qilinmaydi. Yuqori hajmlarda Korxona reja bo'yicha kelishilgan limit qo'yiladi.",
  },
  {
    q: 'Telegram bot qanday sozlanadi?',
    a: "Markaz qo'shilgandan so'ng filadmin paneldan Telegram bot tokenini kiritadi va botni o'z markazi nomi bilan brendlaydi. Ota-onalar bir marta @alochi_bot orqali bog'lanib, kunlik avtomat hisobotlarni qabul qilishni boshlaydi.",
  },
  {
    q: 'Necha rolda yoki filialda ishlash mumkin?',
    a: "Cheklov yo'q. Bitta tenant ichida cheksiz filial, har filialda Filadmin/Manager/Mentor/Tester rollarini istalgancha tarqatish mumkin. Har xodim faqat o'ziga tegishli ma'lumotni ko'radi — multi-tenant izolatsiya kafolatlangan.",
  },
  {
    q: 'Texnik muammoda kim yordam beradi?',
    a: "Markaz xodimlari uchun ish kunlari onlayn yordam bor. O'sayotgan rejada — prioritet yo'l. Korxona rejada esa 24/7 yordam, shaxsiy account manager va SLA 99.99% bilan kafolat. Birinchi javob vaqti — o'rtacha 15 daqiqa.",
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-h2"
      className="relative bg-[var(--background)] scroll-mt-20"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center">
          <div className="inline-flex">
            <span className="section-eyebrow">Savollar</span>
          </div>
          <h2
            id="faq-h2"
            className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--ink)] tracking-[-0.02em] leading-[1.05]"
          >
            Tez-tez beriladigan savollar
          </h2>
          <p className="mt-6 text-lg text-[var(--ink-2)]">
            Javob topa olmasangiz —{' '}
            <a
              href="mailto:javohir.uh@gmail.com"
              className="text-[var(--brand)] font-semibold underline decoration-[1.5px] underline-offset-4 decoration-[var(--brand)]/40 hover:decoration-[var(--brand)] transition-all"
            >
              bizga yozing
            </a>
            , 15 daqiqada javob beramiz.
          </p>
        </div>

        <div className="mt-14 space-y-3">
          {QA.map((item, idx) => (
            <details
              key={item.q}
              className={[
                'group',
                'bg-[var(--surface)]',
                'border border-[var(--line)]',
                'rounded-2xl px-6 py-5',
                'transition-all duration-200 ease-out',
                'hover:border-[var(--brand)]/35',
                'open:border-[var(--brand)]/45 open:shadow-[var(--shadow-2)]',
              ].join(' ')}
              {...(idx === 0 ? { open: true } : {})}
            >
              <summary
                className={[
                  'flex items-center justify-between gap-4',
                  'list-none cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded-md',
                ].join(' ')}
              >
                <span className="font-display text-base sm:text-lg font-bold text-[var(--ink)] tracking-[-0.005em]">
                  {item.q}
                </span>
                <span
                  className={[
                    'faq-chevron shrink-0',
                    'grid place-items-center w-9 h-9 rounded-xl',
                    'bg-[var(--brand-soft)] text-[var(--brand)]',
                    'group-open:bg-[var(--brand)] group-open:text-white',
                    'transition-colors duration-200',
                  ].join(' ')}
                  aria-hidden
                >
                  <ChevronDown size={18} strokeWidth={3} />
                </span>
              </summary>
              <p className="mt-4 text-[15px] leading-[1.7] text-[var(--ink-2)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
