import { ChevronDown } from 'lucide-react';

const QA = [
  {
    q: 'Tizim qaysi qurilmalarda ishlaydi?',
    a: "A'lochi PWA sifatida har qanday smartfon (iOS, Android), planshet va kompyuterda ishlaydi. Bola asosan telefonidan kiradi — tezda yuklanadi va offline rejimda ham asosiy darslarni ochadi.",
  },
  {
    q: 'O’quvchining ma’lumotlari xavfsizmi?',
    a: 'Ha. Biz O’zbekiston PDPL talablariga to’liq mosmiz. Yuz vektorlari faqat 128 o’lchovli son shaklida, AES-256 bilan shifrlangan holda saqlanadi — hech qanday rasm yoki video saqlanmaydi. Ma’lumotlar xosting markazi O’zbekiston hududida.',
  },
  {
    q: 'AI suhbat qancha turadi?',
    a: 'Claude AI har bir o’quvchiga shaxsiy javob beradi va xato tahlilini bera oladi. AI ishlatilishi tanlangan rejaga kiritilgan — alohida hisob talab qilinmaydi. Yuqori hajmlarda Korxona reja bo’yicha kelishilgan limit qo’yiladi.',
  },
  {
    q: 'Telegram bot qanday sozlanadi?',
    a: 'Markaz qo’shilgandan so’ng filadmin paneldan Telegram bot tokenini kiritadi va botni o’z markazi nomi bilan brendlaydi. Ota-onalar bir marta @alochi_bot orqali bog’lanib, kunlik avtomat hisobotlarni qabul qilishni boshlaydi.',
  },
  {
    q: 'Necha rolda yoki filialda ishlash mumkin?',
    a: 'Cheklov yo’q. Bitta tenant ichida cheksiz filial, har filialda Filadmin/Manager/Mentor/Tester rollarini istalgancha tarqatish mumkin. Har xodim faqat o’ziga tegishli ma’lumotni ko’radi — multi-tenant izolatsiya kafolatlangan.',
  },
  {
    q: 'Texnik muammoda kim yordam beradi?',
    a: 'Markaz xodimlari uchun ish kunlari onlayn yordam bor. O’sayotgan rejada — prioritet yo’l. Korxona rejada esa 24/7 yordam, shaxsiy account manager va SLA 99.99% bilan kafolat. Birinchi javob vaqti — o’rtacha 15 daqiqa.',
  },
];

export function FAQ() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-h2"
      className="bg-[#fffaf0] scroll-mt-20"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
            Savollar
          </span>
          <h2
            id="faq-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Tez-tez beriladigan savollar
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {QA.map((item, idx) => (
            <details
              key={item.q}
              className="group bg-white border border-[#e8e0d0] rounded-2xl px-5 py-4 hover:border-[#6d28d9]/30 transition-colors open:border-[#6d28d9]/40 open:shadow-[0_8px_22px_-12px_rgba(109,40,217,0.25)]"
              {...(idx === 0 ? { open: true } : {})}
            >
              <summary className="flex items-center justify-between gap-4 list-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9] rounded-md">
                <span className="text-base sm:text-lg font-extrabold text-[#1e1b4b]">
                  {item.q}
                </span>
                <span
                  className="faq-chevron shrink-0 grid place-items-center w-8 h-8 rounded-full bg-[#6d28d9]/10 text-[#6d28d9]"
                  aria-hidden
                >
                  <ChevronDown size={18} strokeWidth={3} />
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-[#475569] font-semibold">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
