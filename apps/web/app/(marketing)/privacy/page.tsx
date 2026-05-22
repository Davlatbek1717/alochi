/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: "Maxfiylik siyosati — A'lojon",
  description: "A'lojon maxfiylik siyosati — shaxsiy ma'lumotlaringizni qanday yig'ishimiz, ishlatishimiz va himoya qilishimiz.",
};

export default function PrivacyPage() {
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
          Maxfiylik Siyosati
        </h1>
        <p className="mt-3 text-[#64748b] font-semibold">
          Oxirgi yangilanish: 2026-yil 1-may
        </p>

        <div className="mt-10 prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">1. Biz kim?</h2>
            <p className="text-[#475569] leading-relaxed">
              A&apos;lojon — o&apos;quv markazlari uchun SaaS ta&apos;lim platformasi.
              Buxoro viloyati, G'ijduvon tumani, O'zbekiston.
              Aloqa: <a href="mailto:javohir.uh@gmail.com" className="text-[#6d28d9] hover:underline">javohir.uh@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">2. Qanday ma'lumotlar yig'iladi?</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#475569]">
              <li><strong>Identifikatsiya:</strong> Ism, login (foydalanuvchi nomi), telefon raqami</li>
              <li><strong>O'quv ma'lumotlari:</strong> Dars natijalari, imtihon ballari, progress</li>
              <li><strong>Davomat:</strong> Darsga kelish/kelmaslik holati</li>
              <li><strong>Yuz vektori:</strong> Faqat avtomatik davomat uchun; AES-256-GCM bilan shifrlanadi; hech qanday surat saqlanmaydi (O'zbekiston PDPL §533 ga muvofiq)</li>
              <li><strong>Ota-ona aloqa:</strong> Telegram ID (ixtiyoriy, faqat hisobotlar uchun)</li>
              <li><strong>Texnik ma'lumotlar:</strong> IP manzil, brauzer turi (xavfsizlik uchun)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">3. Ma'lumotlar nima maqsadda ishlatiladi?</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#475569]">
              <li>O'quv jarayonini tashkil qilish va natijalarni kuzatish</li>
              <li>Ota-onalarga kunlik Telegram hisobot yuborish</li>
              <li>Davomat nazorati (yuz aniqlash texnologiyasi bilan)</li>
              <li>Tizim xavfsizligi va firibgarlikni oldini olish</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">4. Ma'lumotlar qancha saqlanadi?</h2>
            <p className="text-[#475569] leading-relaxed">
              Faol akkaunt ma'lumotlari — akkaunt faol bo'lgunga qadar.
              Yuz vektori — darhol shifrlanadi, seans tugagandan so'ng vaqtinchalik xotiradan o'chiriladi.
              O'quv tarixi — 3 yil (ta'lim sifatini yaxshilash uchun).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">5. Sizning huquqlaringiz</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#475569]">
              <li><strong>Ko'rish:</strong> O'z ma'lumotlaringizni ko'rish huquqi</li>
              <li><strong>To'g'rilash:</strong> Noto'g'ri ma'lumotlarni to'g'rilash</li>
              <li><strong>O'chirish:</strong> Ma'lumotlarni o'chirish so'rovi (GDPR Art. 17)</li>
              <li><strong>Ko'chirish:</strong> Ma'lumotlaringizni JSON formatda olish</li>
            </ul>
            <p className="mt-3 text-[#475569]">
              So'rovlar uchun: <a href="mailto:javohir.uh@gmail.com" className="text-[#6d28d9] hover:underline">javohir.uh@gmail.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">6. Uchinchi tomon xizmatlar</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#475569]">
              <li><strong>Google Gemini AI</strong> — AI tutor (dars konteksti va savollar yuboriladi, shaxsiy ma'lumotlar yuborilmaydi)</li>
              <li><strong>Telegram</strong> — ota-onalarga hisobot yuborish</li>
              <li><strong>Azure Speech Services</strong> — talaffuz baholash (audio faqat tranzit, saqlanmaydi)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">7. Cookie fayllari</h2>
            <p className="text-[#475569] leading-relaxed">
              Faqat zaruriy cookie fayllar ishlatiladi (autentifikatsiya tokenlari).
              Reklama yoki kuzatish cookie fayllari ishlatilmaydi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-extrabold text-[#1e1b4b] mb-3">8. Aloqa</h2>
            <p className="text-[#475569]">
              Savollar uchun: <a href="mailto:javohir.uh@gmail.com" className="text-[#6d28d9] hover:underline">javohir.uh@gmail.com</a>
              yoki <a href="https://t.me/Javohir_UH" target="_blank" rel="noopener noreferrer" className="text-[#6d28d9] hover:underline">@Javohir_UH</a>
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
