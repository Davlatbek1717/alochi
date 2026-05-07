'use client';
import { useEffect } from 'react';

/**
 * Calls `refetch` whenever a named CustomEvent fires on `window`. Used
 * with the dashboard's RevalidationProvider so a server-side mutation
 * (status update, XP earned, certificate awarded) propagates to every
 * open dashboard tab in real time without page-level polling.
 *
 * `events` is one or more event-detail.type values to react to. Pass
 * `'*'` to revalidate on any event (rare — most pages care about one
 * or two specific signals).
 */
export function useRevalidateOnEvent(
  events: string | string[],
  refetch: () => void,
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const list = Array.isArray(events) ? events : [events];
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type?: string }>;
      const t = ce.detail?.type;
      if (!t) return;
      if (list.includes('*') || list.includes(t)) refetch();
    };
    window.addEventListener('alochi:revalidate', handler as EventListener);
    return () => {
      window.removeEventListener('alochi:revalidate', handler as EventListener);
    };
  }, [refetch, events]);
}
