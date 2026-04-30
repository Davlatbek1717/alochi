'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'pwa-install-dismissed';

function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  const isStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && isSafari && !isStandalone;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (isIOSSafari()) {
      setShowIOSHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-xs z-50 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl">
      <button
        onClick={dismiss}
        aria-label="Yopish"
        className="absolute top-2 right-2 text-slate-500 hover:text-slate-300"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">Alochi&apos;ni o&apos;rnatish</h3>
          {showIOSHint ? (
            <p className="text-xs text-slate-400">
              Share tugmasi → &quot;Add to Home Screen&quot; orqali o&apos;rnating.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">
                Tezroq ochish uchun telefoningizga o&apos;rnating.
              </p>
              <button
                onClick={install}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
              >
                O&apos;rnatish
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
