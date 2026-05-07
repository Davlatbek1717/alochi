'use client';

/**
 * Lightweight client-side sound effects for the student panel.
 *
 * Implementation: Web Audio API tone generator. No external mp3 files needed —
 * each sound is synthesized on demand (small oscillators + envelopes). This
 * eliminates 404s when audio assets aren't deployed and gives instant playback.
 *
 *  - Gracefully no-ops on the server (typeof window === 'undefined').
 *  - Honors a `soundEnabled` localStorage flag (default ON, toggle OFF).
 *  - AudioContext is lazy-created on first user gesture (autoplay policy).
 *  - All errors are silently swallowed so a hostile environment never breaks UI.
 */

export type SoundKey = 'correct' | 'wrong' | 'complete' | 'xp' | 'levelup';

const STORAGE_KEY = 'soundEnabled';

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

interface ToneSpec {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  startAt?: number; // seconds offset from "now"
  gain?: number; // peak gain (0..1)
}

function playTones(specs: ToneSpec[], masterVolume = 0.4): void {
  const context = getContext();
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
  const now = context.currentTime;
  for (const s of specs) {
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = s.type ?? 'sine';
      osc.frequency.setValueAtTime(s.freq, now + (s.startAt ?? 0));
      const peak = (s.gain ?? 0.6) * masterVolume;
      const start = now + (s.startAt ?? 0);
      const end = start + s.duration;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(end + 0.05);
    } catch {
      // ignore per-tone errors
    }
  }
}

const RECIPES: Record<SoundKey, () => void> = {
  // Bright two-note chime, ascending
  correct: () =>
    playTones([
      { freq: 880, duration: 0.12, type: 'triangle', gain: 0.5 },
      { freq: 1318.5, duration: 0.18, type: 'triangle', startAt: 0.1, gain: 0.5 },
    ]),
  // Soft low buzz, descending
  wrong: () =>
    playTones([
      { freq: 240, duration: 0.18, type: 'sawtooth', gain: 0.35 },
      { freq: 180, duration: 0.22, type: 'sawtooth', startAt: 0.1, gain: 0.35 },
    ]),
  // Coin-pickup quick blip
  xp: () =>
    playTones([
      { freq: 988, duration: 0.06, type: 'square', gain: 0.4 },
      { freq: 1318.5, duration: 0.1, type: 'square', startAt: 0.06, gain: 0.4 },
    ]),
  // Triumphal arpeggio
  complete: () =>
    playTones([
      { freq: 523.25, duration: 0.14, type: 'triangle' },
      { freq: 659.25, duration: 0.14, type: 'triangle', startAt: 0.13 },
      { freq: 783.99, duration: 0.16, type: 'triangle', startAt: 0.26 },
      { freq: 1046.5, duration: 0.34, type: 'triangle', startAt: 0.4 },
    ]),
  // Ascending fanfare for level-up
  levelup: () =>
    playTones([
      { freq: 523.25, duration: 0.12, type: 'triangle' },
      { freq: 783.99, duration: 0.12, type: 'triangle', startAt: 0.1 },
      { freq: 1046.5, duration: 0.18, type: 'triangle', startAt: 0.22 },
      { freq: 1567.98, duration: 0.42, type: 'triangle', startAt: 0.38 },
    ]),
};

/**
 * Play a sound effect by key. Safe to call on the server (no-op) and during
 * SSR / before hydration. Volume parameter is kept for backward compatibility
 * but is ignored (peak gains are tuned per-recipe).
 */
export function playSound(key: SoundKey, _volume = 0.6): void {
  void _volume;
  if (typeof window === 'undefined' || !isEnabled()) return;
  try {
    RECIPES[key]?.();
  } catch {
    // synthesis failed — silent no-op
  }
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
    // Quota / privacy mode — ignore.
  }
}

export function isSoundEnabled(): boolean {
  return isEnabled();
}

/**
 * Unlock the AudioContext from a user-gesture handler. iOS Safari and
 * Android Chrome create the context in `suspended` state until a real
 * user gesture resumes it. After this is called once, subsequent
 * playSound() calls (even from non-gesture paths like a speech-
 * recognition callback) play correctly.
 */
export function unlockAudio(): void {
  const context = getContext();
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
}
