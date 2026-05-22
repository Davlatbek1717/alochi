/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: "Foydalanish shartlari — A'lojon",
  description: "A'lojon platformasidan foydalanish shartlari va qoidalari.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f4ef]">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#6d28d9] hover:text-[#5b21b6] mb-10 transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={2.75} /> Bosh sahifaga
        </Link>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1e1b4b] tracking-tight">
          Foydalanish Shartlari
        </h1>
        <p className="mt-3 text-[#64748b] font-semibold">
          Oxirgi yangilanish: 2026-yil 1-may
        </p>

        <div className="mt-10 space-y-8">

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">1. Umumiy qoidalar</h2>
            <p className="text-[#475569] leading-relaxed">
              A'lojon platformasidan foydalanish ushbu shartlarga rozilikni bildiradi.
              Agar siz ushbu shartlarga rozi bo'lmasangiz, platformadan foydalanmang.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">2. Xizmat tavsifi</h2>
            <p className="text-[#475569] leading-relaxed">
              A'lojon — o'quv markazlari uchun multi-tenant SaaS ta'lim platformasi.
              Platforma o'qituvchi-o'quvchi interaksiyasini, imtihon o'tkazishni, davomat
              nazoratini va ota-onalar bilan aloqani avtomatlashtiradi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">3. Sinov davri</h2>
            <p className="text-[#475569] leading-relaxed">
              Yangi ro'yxatdan o'tgan markazlar uchun 14 kunlik bepul sinov davri mavjud.
              Sinov davri tugagandan so'ng to'lov qilinmasa, markaz vaqtinchalik to'xtatiladi.
              Barcha ma'lumotlar saqlanadi va to'lovdan so'ng darhol tiklash mumkin.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">4. Foydalanuvchi majburiyatlari</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#475569]">
              <li>Haqiqiy va to'g'ri ma'lumot kiritish</li>
              <li>Login va parolni uchinchi shaxslarga bermaslik</li>
              <li>Platformani qonuniy maqsadlarda ishlatish</li>
              <li>O'quvchilarning shaxsiy ma'lumotlarini himoya qilish</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">5. Ma'lumotlar egaligi</h2>
            <p className="text-[#475569] leading-relaxed">
              Siz platformaga kiritgan ma'lumotlar (o'quvchilar, darslar, natijalar) —
              sizning mulkingiz. A'lojon ushbu ma'lumotlarni faqat xizmat ko'rsatish
              maqsadida ishlatadi va uchinchi shaxslarga sotmaydi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">6. Xizmat to'xtatilishi</h2>
            <p className="text-[#475569] leading-relaxed">
              A'lojon quyidagi holatlarda markaz akkauntini to'xtatish huquqini saqlaydi:
              shartlar buzilishi, to'lov amalga oshirilmaganda, qonuniy talablar asosida.
              To'xtatishdan kamida 7 kun oldin xabar beriladi (favqulodda hollar bundan mustasno).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">7. Mas'uliyat chegarasi</h2>
            <p className="text-[#475569] leading-relaxed">
              A'lojon internet uzilishlari, server nosozliklari yoki fors-major holatlari
              tufayli yuzaga keladigan yo'qotishlar uchun javobgar emas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">8. O'zgarishlar</h2>
            <p className="text-[#475569] leading-relaxed">
              Ushbu shartlar o'zgartirilishi mumkin. Muhim o'zgarishlar haqida elektron
              pochta yoki Telegram orqali xabar beriladi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">9. Aloqa</h2>
            <p className="text-[#475569]">
              Savollar uchun:{' '}
              <a href="mailto:javohir.uh@gmail.com" className="text-[#6d28d9] hover:underline">
                javohir.uh@gmail.com
              </a>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
