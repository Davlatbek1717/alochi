'use client';
import { useEffect } from 'react';

/**
 * Calls `refetch` whenever the page becomes visible again — when the
 * user switches back to the tab, returns from another window, or
 * comes back from a long sleep. Supplements the initial mount fetch
 * so the screen never lags behind the server for a noticeable time.
 *
 * No-op on the server. Safe to register inside a useEffect with [].
 */
export function useFocusRevalidate(refetch: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', refetch);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refetch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refetch]);
}
