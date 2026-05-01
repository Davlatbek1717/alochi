'use client';

import { useEffect } from 'react';

/**
 * Auto-unregister any stale service worker + clear caches in development.
 *
 * Why: in dev (where PWA is disabled), a service worker left over from a
 * previous production build keeps intercepting requests and returns 404 for
 * asset URLs whose hashes have changed since the SW was installed. Manually
 * clearing in DevTools is friction; this hook does it for every dev visitor
 * automatically — runs once on mount, no-ops in production.
 */
export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let needsReload = false;

    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (regs.length === 0) return;
        needsReload = true;
        return Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      })
      .then(() => {
        if ('caches' in window) {
          return caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => false))));
        }
        return undefined;
      })
      .then(() => {
        if (needsReload) {
          // Reload once so the now-clean page can fetch fresh assets directly.
          window.location.reload();
        }
      })
      .catch(() => {
        /* best effort */
      });
  }, []);

  return null;
}
