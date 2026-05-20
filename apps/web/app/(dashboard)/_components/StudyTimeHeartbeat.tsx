'use client';
import { useEffect, useRef } from 'react';

/**
 * Daily study-time heartbeat.
 *
 * Mounted once for the student role (see DashboardLayout). It accrues
 * *active* seconds while the tab is visible and the user is not idle
 * (any route counts toward the daily cap — not just learning routes).
 *
 * Every ~60s of accrued activity (or on tab hide / unmount) it POSTs
 * the delta to /study-time/ping. The server clamps everything — this is
 * best-effort and never blocks the UI.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const IDLE_MS = 3 * 60 * 1000; // 3 min without interaction = idle
const FLUSH_SECONDS = 60; // send after this much accrued activity
const MAX_FLUSH_GAP_MS = 75 * 1000; // also flush stragglers this often

export function StudyTimeHeartbeat() {
  const accRef = useRef(0); // accrued, not-yet-sent active seconds
  const lastActivityRef = useRef(Date.now());
  const lastFlushRef = useRef(Date.now());
  const sendingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const activityEvents: (keyof DocumentEventMap)[] = [
      'pointerdown',
      'keydown',
      'scroll',
      'touchstart',
      'mousemove',
    ];
    activityEvents.forEach((e) =>
      document.addEventListener(e, markActive, { passive: true }),
    );

    const flush = (useBeacon: boolean) => {
      const seconds = Math.round(accRef.current);
      if (seconds <= 0 || sendingRef.current) return;
      const token = window.localStorage.getItem('accessToken');
      if (!token) return;
      accRef.current = 0;
      lastFlushRef.current = Date.now();
      sendingRef.current = true;
      // keepalive lets the request survive a tab close / navigation while
      // still allowing the Authorization header (sendBeacon can't).
      fetch(`${BASE_URL}/study-time/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deltaSeconds: seconds }),
        keepalive: useBeacon,
      })
        .catch(() => {
          /* best-effort — drop on failure, server clamps anyway */
        })
        .finally(() => {
          sendingRef.current = false;
        });
    };

    const tick = () => {
      const now = Date.now();
      const visible = document.visibilityState === 'visible';
      const active = now - lastActivityRef.current < IDLE_MS;
      if (visible && active) {
        accRef.current += 1;
      }
      if (
        accRef.current >= FLUSH_SECONDS ||
        (accRef.current > 0 && now - lastFlushRef.current >= MAX_FLUSH_GAP_MS)
      ) {
        flush(false);
      }
    };

    const intervalId = window.setInterval(tick, 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((e) =>
        document.removeEventListener(e, markActive),
      );
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      flush(true); // unmount / role change — don't lose the partial minute
    };
  }, []);

  return null;
}
