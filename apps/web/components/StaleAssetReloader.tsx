'use client';
import { useEffect } from 'react';

/**
 * Detect stale /_next/static/* asset references left over from a previous
 * build. When the server redeploys, the new bundle ships fresh content
 * hashes, but a browser tab still holding the old HTML keeps requesting
 * the old chunk + CSS filenames. The server returns the SPA's HTML
 * (200 OK, `text/html`) for those missing paths — the browser then
 * rejects them ("MIME type ... is not a supported stylesheet MIME type")
 * and the page renders unstyled or with broken JS islands.
 *
 * React's error.tsx already covers JS chunk-load failures (those throw a
 * ChunkLoadError into the render tree). CSS load failures are silent —
 * they fire a low-level `error` event on the <link> element and never
 * reach React. Listen for those at the document level and reload once,
 * guarded against a reload loop the same way error.tsx is.
 */
const RELOAD_GUARD_KEY = 'chunk-error-reloaded-at';
const RELOAD_COOLDOWN_MS = 30_000;

function isStaleNextAsset(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLLinkElement) && !(target instanceof HTMLScriptElement)) {
    return false;
  }
  const url =
    target instanceof HTMLLinkElement ? target.href : target.src;
  if (!url) return false;
  // Only auto-reload for our own Next.js build assets so that a 404 from
  // an external script (Telegram widget, analytics) doesn't loop us.
  return /\/_next\/static\/(css|chunks|media)\//.test(url);
}

function reloadOnce() {
  if (typeof window === 'undefined') return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    const now = Date.now();
    if (now - last <= RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    /* sessionStorage unavailable in private mode — best-effort */
  }
  window.location.reload();
}

export function StaleAssetReloader() {
  useEffect(() => {
    function onResourceError(e: Event) {
      if (isStaleNextAsset(e.target)) reloadOnce();
    }
    // `useCapture: true` so we catch the asset-level error event before it
    // bubbles up (most browsers don't bubble these — capture is the only
    // reliable way to observe them from window level).
    window.addEventListener('error', onResourceError, true);
    return () => window.removeEventListener('error', onResourceError, true);
  }, []);
  return null;
}
