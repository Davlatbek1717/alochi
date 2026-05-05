import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

export default function StudentNotFound() {
  return (
    <div className="marketing-root font-[var(--font-nunito)] bg-[#fffaf0] text-[#1e1b4b] min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-4 py-20">
        <div className="text-7xl mb-6" aria-hidden>
          🔍
        </div>
        <h1 className="text-3xl font-extrabold text-[#1e1b4b] tracking-tight">
          O&apos;quvchi topilmadi
        </h1>
        <p className="mt-3 text-base font-semibold text-[#64748b] max-w-sm mx-auto">
          Bunday profil mavjud emas yoki o&apos;chirilgan bo&apos;lishi mumkin.
        </p>
        <Link
          href="/#students"
          className="mt-8 inline-flex items-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-sm px-6 py-3 rounded-xl shadow-[0_6px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all"
        >
          <ArrowLeft size={15} strokeWidth={2.75} />
          Barcha o&apos;quvchilar
        </Link>
      </div>
    </div>
  );
}
