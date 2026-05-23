'use client';
import { useEffect, useRef } from 'react';

/**
 * Runs `callback` every `ms` milliseconds, but ONLY while the tab is visible
 * (#26). Background tabs stop polling entirely and fire one immediate refresh
 * when brought back to the foreground.
 *
 * This kills the "cross-tab polling storm": a user with the dashboard open in
 * five background tabs previously hammered the API on every tab's timer; now
 * only the foreground tab polls. No-op on the server.
 *
 * Pass `enabled = false` to suspend polling (e.g. while a modal is open).
 */
export function useVisibilityInterval(
  callback: () => void,
  ms: number,
  enabled = true,
): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer != null) return;
      timer = setInterval(() => saved.current(), ms);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        saved.current(); // immediate catch-up
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ms, enabled]);
}
