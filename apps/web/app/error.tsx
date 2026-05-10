'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Detect Next.js ChunkLoadError. Triggered when a redeploy invalidates
 * the chunk filenames a stale browser session is still trying to fetch
 * (the new build assigns fresh hashes; old chunks 404). The user has
 * no way to recover except a hard refresh, so we do it for them.
 */
function isChunkLoadError(err: Error & { name?: string }): boolean {
  if (!err) return false;
  if (err.name === 'ChunkLoadError') return true;
  const msg = err.message ?? '';
  return /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported/i.test(
    msg,
  );
}

const RELOAD_GUARD_KEY = 'chunk-error-reloaded-at';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
    // Auto-recover from chunk-load failures by hard-reloading the page so
    // the browser fetches the new HTML + chunk manifest. Guard against a
    // reload loop: if we already reloaded for this exact reason in the
    // last 30s, fall through to the manual error UI instead of looping.
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
        // sessionStorage unavailable (private mode) — best-effort reload.
        window.location.reload();
        return;
      }
    }
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
