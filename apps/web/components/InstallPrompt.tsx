'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui';

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
    <div className="fixed bottom-20 right-4 md:bottom-4 max-w-xs z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
      <button
        onClick={dismiss}
        aria-label="Yopish"
        className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 rounded"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0">
          <Download size={20} className="text-white" />
        </div>
        <div className="flex-1 pr-4">
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
              <Button
                variant="primary"
                size="sm"
                icon={<Download size={13} />}
                onClick={install}
              >
                O&apos;rnatish
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
