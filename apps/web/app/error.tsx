'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-red-900/40 border border-red-700/40 flex items-center justify-center">
          <AlertTriangle size={36} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Xatolik yuz berdi</h1>
        <p className="text-slate-400 text-sm mb-8">
          Nimadir noto&apos;g&apos;ri ketdi. Qayta urinib ko&apos;ring.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <RefreshCw size={16} />
          Qayta urinish
        </button>
      </div>
    </div>
  );
}
