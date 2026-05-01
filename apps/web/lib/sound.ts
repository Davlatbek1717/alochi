'use client';

/**
 * Lightweight client-side sound effects for the student panel.
 *
 * Design notes:
 *  - Lazy-cached <audio> elements per key — first call constructs, subsequent
 *    calls reuse and just rewind via `currentTime = 0`.
 *  - Gracefully no-ops on the server (typeof window === 'undefined').
 *  - Honors a `soundEnabled` localStorage flag (default ON, toggle OFF).
 *  - Tolerates autoplay-policy rejections — `audio.play()` returns a Promise
 *    we silently swallow so the UI never sees an unhandled rejection if a
 *    file is missing or the browser blocks autoplay.
 *
 * Asset files live in apps/web/public/sounds/ — see README there for the spec.
 * If a file is missing, this module still works (the catch handles ENOENT).
 */

const SOUNDS = {
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  complete: '/sounds/complete.mp3',
  xp: '/sounds/xp.mp3',
  levelup: '/sounds/levelup.mp3',
} as const;

export type SoundKey = keyof typeof SOUNDS;

const STORAGE_KEY = 'soundEnabled';

const cache: Partial<Record<SoundKey, HTMLAudioElement>> = {};

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    // localStorage can throw in private mode / sandboxed iframes — treat as enabled.
    return true;
  }
}

/**
 * Play a sound effect by key. Volume defaults to 0.6 to avoid being jarring.
 * Safe to call on the server (no-op) and during SSR / before hydration.
 */
export function playSound(key: SoundKey, volume = 0.6): void {
  if (typeof window === 'undefined' || !isEnabled()) return;
  let audio = cache[key];
  if (!audio) {
    audio = new Audio(SOUNDS[key]);
    audio.preload = 'auto';
    cache[key] = audio;
  }
  audio.volume = Math.min(1, Math.max(0, volume));
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers throw if the media isn't seekable yet — ignore.
  }
  void audio.play().catch(() => {
    // Autoplay blocked or asset missing — no-op by design.
  });
}

/**
 * Persist the user's sound preference. Affects all future playSound() calls
 * across the whole app immediately (no reload needed).
 */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Quota / privacy mode — ignore; preference simply won't persist.
  }
}

export function isSoundEnabled(): boolean {
  return isEnabled();
}
