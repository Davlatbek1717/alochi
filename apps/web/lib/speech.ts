'use client';

/**
 * Web Speech API wrapper — TTS + STT for the student panel.
 *
 * Strategy:
 *  - speechSynthesis is widely available; gracefully no-ops if absent.
 *  - SpeechRecognition / webkitSpeechRecognition: Chrome/Edge/Safari OK,
 *    Firefox no. Callers should check capabilities() first and fall back
 *    to MediaRecorder + server STT.
 *  - All functions are SSR-safe (typeof window guards).
 *  - A localStorage flag (`webSpeechEnabled`, default 'true') lets the
 *    student fully disable the browser path from /student/profile so
 *    everything routes back through the server endpoints.
 */

interface Capabilities {
  /** True when SpeechSynthesis is available AND the user hasn't disabled
   *  the browser-speech preference. */
  tts: boolean;
  /** True when SpeechRecognition is available AND the user hasn't disabled
   *  the browser-speech preference. */
  stt: boolean;
}

const PREF_KEY = 'webSpeechEnabled';

/**
 * Whether the user has the browser-speech path enabled in settings.
 * Default ON. Reads localStorage; safe on SSR (returns true).
 */
export function getWebSpeechPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Persist the user's browser-speech preference. */
export function setWebSpeechPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREF_KEY, String(enabled));
  } catch {
    // Quota / privacy mode — ignore.
  }
}

/**
 * Detect browser support for TTS + STT. Returns false for both on the
 * server, when the user has disabled the preference, or when the global
 * isn't present in this browser. Callers gate behavior on this.
 */
export function getSpeechCapabilities(): Capabilities {
  if (typeof window === 'undefined') return { tts: false, stt: false };
  if (!getWebSpeechPreference()) return { tts: false, stt: false };
  const tts = 'speechSynthesis' in window;
  const SR =
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  return { tts, stt: !!SR };
}

interface SpeakOptions {
  lang?: 'en-US' | 'en-GB' | 'uz-UZ';
  /** 0.1 - 10, default 1. Use ~0.9 for kids. */
  rate?: number;
  /** 0 - 2, default 1. */
  pitch?: number;
  /** 0 - 1, default 1. */
  volume?: number;
}

/** Voice list resolves async on Chrome — wait once for `voiceschanged`
 *  if the synchronous list is empty. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish, { once: true });
    // Hard cap so we don't hang forever on browsers that never fire the event.
    setTimeout(finish, 600);
  });
}

/**
 * Speak text via SpeechSynthesis. Resolves when finished, rejects on error.
 * Cancels any in-progress utterance first so playback never overlaps.
 *
 * For Uzbek prompts: returns immediately if no Uzbek voice exists; caller
 * should display the text alongside so kids can read what they would have
 * heard. We pick `localService` voices first when available — they're
 * higher quality and have no per-call latency.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      reject(new Error('SpeechSynthesis not available'));
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    // Cancel any in-progress speech (avoids overlapping audio).
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }

    const lang = opts.lang ?? 'en-US';

    const start = (voices: SpeechSynthesisVoice[]) => {
      const u = new SpeechSynthesisUtterance(trimmed);
      u.lang = lang;
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.volume = opts.volume ?? 1;

      // Voice picker: exact-match local voice → exact-match any voice →
      // language-prefix match → first voice. Local voices are preferred
      // because they're offline and low-latency.
      if (voices.length > 0) {
        const exactLocal = voices.find((v) => v.lang === lang && v.localService);
        const exact = voices.find((v) => v.lang === lang);
        const prefix = lang.split('-')[0];
        const prefixMatch = voices.find((v) => v.lang.startsWith(prefix));
        const chosen = exactLocal ?? exact ?? prefixMatch;
        if (chosen) u.voice = chosen;
      }

      u.onend = () => resolve();
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        // 'canceled' / 'interrupted' aren't real errors — caller cancelled.
        if (e.error === 'canceled' || e.error === 'interrupted') resolve();
        else reject(new Error(e.error || 'speak failed'));
      };

      try {
        synth.speak(u);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('speak failed'));
      }
    };

    void loadVoices().then(start);
  });
}

/** Stop any ongoing speech synthesis immediately. SSR-safe. */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

interface ListenHandle {
  stop: () => void;
}

interface ListenOptions {
  lang?: 'en-US' | 'en-GB' | 'uz-UZ';
  /** If true, the recognizer keeps listening past the first pause. Default false. */
  continuous?: boolean;
  /** Fired with each interim transcript. Useful for live captions. */
  onInterim?: (text: string) => void;
  /** Fired ONCE when the recognizer has a final result. */
  onResult: (text: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

/**
 * Start listening. Returns a handle with `.stop()`. Caller must check
 * `getSpeechCapabilities().stt` first — this throws if SR is not available.
 *
 * The handle's stop() is idempotent: calling it on an already-stopped
 * recognizer is a no-op (errors are swallowed).
 */
export function listen(opts: ListenOptions): ListenHandle {
  if (typeof window === 'undefined') {
    throw new Error('listen() called on server');
  }
  const SR =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ||
    (window as unknown as {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).webkitSpeechRecognition;
  if (!SR) throw new Error('SpeechRecognition not supported in this browser');

  const recog = new SR();
  recog.lang = opts.lang ?? 'en-US';
  recog.continuous = !!opts.continuous;
  recog.interimResults = !!opts.onInterim;
  recog.maxAlternatives = 1;

  // With `continuous: true` the recognizer issues a separate result entry
  // per utterance (a pause finalises the previous one). The browser does
  // NOT concatenate them for us — `event.results[i]` only holds that
  // segment's text. Callers that need the full conversation transcript
  // (e.g. SpeakWords cursor-based matching) would only see the most
  // recent word and silently miss the earlier ones.
  //
  // To make the public API intuitive, listen() emits the *cumulative*
  // transcript: all previously-finalised segments concatenated, plus
  // the running interim of the current utterance overlaid on top.
  // Single-utterance callers (continuous=false) get the same string,
  // just shorter.
  const finalizedSegments: string[] = [];

  recog.onresult = (event: SpeechRecognitionEventLike) => {
    const last = event.results[event.results.length - 1];
    const segText = (last?.[0]?.transcript ?? '').trim();
    if (last?.isFinal) {
      if (segText) finalizedSegments.push(segText);
      const cumulative = finalizedSegments.join(' ').trim();
      opts.onResult(cumulative);
    } else {
      const base = finalizedSegments.join(' ');
      const cumulative = (base ? `${base} ${segText}` : segText).trim();
      opts.onInterim?.(cumulative);
    }
  };
  recog.onerror = (event: { error?: string }) => {
    opts.onError?.(event.error ?? 'unknown');
  };
  recog.onend = () => {
    opts.onEnd?.();
  };

  try {
    recog.start();
  } catch (err) {
    // A second start() while running throws InvalidStateError — surface as error.
    opts.onError?.(err instanceof Error ? err.message : 'start_failed');
  }

  return {
    stop: () => {
      try {
        recog.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/**
 * Score a spoken word/sentence against the canonical text using simple
 * client-side similarity. Returns 0-100. Forgives case + light punctuation
 * + diacritics.
 *
 * For grading dictation/pronunciation client-side without burning AI calls.
 * Backed by Levenshtein edit distance over normalized strings.
 */
export function similarityScore(spoken: string, canonical: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip combining marks
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(spoken);
  const b = norm(canonical);
  if (!a || !b) return 0;
  if (a === b) return 100;

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.round((1 - dist / maxLen) * 100);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[] = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j], dp[j - 1]) + 1;
      prev = tmp;
    }
  }
  return dp[n];
}

// --- Minimal structural typings for the WebKit/Standard SpeechRecognition
//     API. We intentionally keep these narrow — only the bits we use — so
//     this file works without `lib.dom.iterable` extensions or a global
//     SpeechRecognition declaration.

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}
interface SpeechRecognitionResultLike
  extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike> & {
    [index: number]: SpeechRecognitionResultLike;
    length: number;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
