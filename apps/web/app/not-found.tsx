import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <FileQuestion size={36} className="text-slate-400" />
        </div>
        <h1 className="text-5xl font-black text-white mb-3">404</h1>
        <p className="text-xl font-semibold text-slate-300 mb-2">Sahifa topilmadi</p>
        <p className="text-slate-400 text-sm mb-8">
          Siz qidirayotgan sahifa mavjud emas yoki ko&apos;chirilgan.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
