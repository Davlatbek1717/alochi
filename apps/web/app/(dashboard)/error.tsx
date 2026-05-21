'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

function isChunkLoadError(err: Error & { name?: string }): boolean {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const msg = err.message ?? '';
  return /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported/i.test(msg);
}

const RELOAD_GUARD_KEY = 'chunk-error-reloaded-at';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      try {
        const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
        const now = Date.now();
        if (now - last > 30_000) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
          window.location.reload();
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-red-900/30 border border-red-700/30 flex items-center justify-center">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Xatolik yuz berdi</h2>
        <p className="text-slate-400 text-sm mb-6">
          Bu sahifa yuklanmadi. Qayta urinib ko&apos;ring.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Qayta urinish
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            <Home size={14} />
            Bosh sahifa
          </Link>
        </div>
      </div>
    </div>
  );
}
