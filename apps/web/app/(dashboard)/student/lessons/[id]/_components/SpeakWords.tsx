'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Mic,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import {
  getSpeechCapabilities,
  listen,
  similarityScore,
  speak,
  stopSpeaking,
} from '@/lib/speech';
import { XpFloater } from './XpFloater';
import type { SpeakWordsConfig } from './exercise-types';

interface SpeakWordsProps {
  config: SpeakWordsConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type WordStatus = 'pending' | 'active' | 'correct' | 'wrong';
type Phase = 'idle' | 'listening' | 'passed' | 'failed';

// Per-word match threshold on the 0-100 scale returned by
// similarityScore(). 90 forgives a single-character STT mishearing
// on most words ("morning" → "mornin" still passes at 86 fails, but
// "morning" → "mornings" at 88 fails) while still catching clearly
// wrong words. Practical sweet spot between 100 (too strict — Web
// Speech mishearings false-fail) and 65 (too lax — "launch" passes
// for "morning").
const WORD_MATCH_THRESHOLD = 90;

/**
 * Normalize a word for comparison: lowercase, strip diacritics + all
 * non-letter/digit characters. Display strings keep their original
 * punctuation so "Mexican" still reads as "Mexican".
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();
}

/**
 * Pass 6 (J) — Speak Words (Monkeytype-style read-aloud).
 *
 * Layout:
 *   - Header with Aloqush + "So'zlarni ovozli o'qing" caption.
 *   - Word grid: each word in its own pill. Active word has a blinking
 *     underline; correct words turn green; wrong words turn red.
 *   - Bottom: large mic button. While listening, an interim caption
 *     strip shows the running transcript so the student gets feedback.
 *   - On pass (≥minScore correct): green banner + +10 XP + auto-advance.
 *   - On fail: red banner + per-word "🔊 Talaffuz" buttons for every
 *     wrong word so the student can hear the correct pronunciation.
 *
 * Browser-only. If SpeechRecognition isn't available (Firefox, settings
 * off, etc.) we show a polite skip card — there's no server stream API
 * for word-by-word audio.
 */
export function SpeakWords({ config, onPassed, onFailed }: SpeakWordsProps) {
  const text = (config?.text ?? '').trim();
  const minScore = typeof config?.minScore === 'number' ? config.minScore : 70;

  // Tokenize on whitespace; punctuation stays attached to display strings.
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const malformed = !text || words.length === 0;

  const [statuses, setStatuses] = useState<WordStatus[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [permError, setPermError] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const listenHandleRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);
  // Refs mirror state for the listen() callbacks, which capture stale
  // React state through closures.
  const statusesRef = useRef<WordStatus[]>([]);
  const cursorRef = useRef(0);
  const finishedRef = useRef(false);

  // Initialize per-word statuses whenever the word list changes.
  useEffect(() => {
    const init: WordStatus[] = words.map((_, i) =>
      i === 0 ? 'active' : 'pending',
    );
    setStatuses(init);
    statusesRef.current = init;
    cursorRef.current = 0;
    finishedRef.current = false;
    setPhase('idle');
    setFinalScore(null);
    setInterimTranscript('');
  }, [words]);

  useEffect(() => {
    mountedRef.current = true;
    setSttAvailable(getSpeechCapabilities().stt);
    return () => {
      mountedRef.current = false;
      try {
        listenHandleRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        stopSpeaking();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (malformed) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bu mashq sozlanmagan
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Ovozli o&apos;qish topshirig&apos;ida matn yo&apos;q.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  if (!sttAvailable && phase === 'idle' && statuses.length > 0) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Brauzeringiz ovoz tanigichini qo&apos;llab-quvvatlamaydi
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Chrome yoki Edge brauzerida oching, yoki bu mashqni o&apos;tkazib yuboring.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          O&apos;tkazib yuborish
        </Button>
      </div>
    );
  }

  /**
   * Process a transcript update from the recognizer. Aligns spoken tokens
   * with the expected words at index ≥ cursor and advances the cursor.
   *
   * Algorithm: walk transcript tokens index-aligned to expected words from
   * the cursor forward. For each pair, mark green/red by Levenshtein
   * similarity. The next pending word becomes 'active' (the live cursor).
   * Auto-finishes when the cursor reaches the end of the word list.
   */
  function processTranscript(transcript: string) {
    if (finishedRef.current) return;
    const spoken = transcript
      .split(/\s+/)
      .filter(Boolean)
      .map(normalize)
      .filter(Boolean);

    let cursor = cursorRef.current;
    const next = [...statusesRef.current];

    while (cursor < words.length && cursor < spoken.length) {
      const expected = normalize(words[cursor]);
      if (!expected) {
        // Pure punctuation token — skip past it.
        next[cursor] = 'correct';
        cursor += 1;
        continue;
      }
      const sim = similarityScore(spoken[cursor], expected);
      next[cursor] = sim >= WORD_MATCH_THRESHOLD ? 'correct' : 'wrong';
      cursor += 1;
    }
    if (cursor < words.length) next[cursor] = 'active';

    statusesRef.current = next;
    cursorRef.current = cursor;
    if (mountedRef.current) setStatuses(next);

    if (cursor >= words.length) {
      finishExercise();
    }
  }

  function startListening() {
    if (phase === 'listening') return;
    setPermError('');
    setInterimTranscript('');
    setFinalScore(null);
    finishedRef.current = false;
    // Reset to fresh-start statuses if previously failed/passed.
    if (phase !== 'idle') {
      const init: WordStatus[] = words.map((_, i) =>
        i === 0 ? 'active' : 'pending',
      );
      statusesRef.current = init;
      cursorRef.current = 0;
      setStatuses(init);
    }

    stopSpeaking();
    try {
      const handle = listen({
        lang: 'en-US',
        // Continuous mode so the student can pause briefly mid-sentence
        // without ending the recognition session.
        continuous: true,
        onInterim: (txt) => {
          // Live caption only — DON'T advance the cursor. Interim text
          // grows letter-by-letter ("h" → "he" → "hello"), so any
          // similarityScore against the expected word would briefly
          // dip below the match threshold and falsely mark the word
          // wrong before the speaker finishes saying it.
          if (!mountedRef.current) return;
          setInterimTranscript(txt);
        },
        onResult: (txt) => {
          // Final result for the latest utterance — recognition has
          // committed to the wording, safe to advance the cursor and
          // colour the words.
          if (!mountedRef.current) return;
          setInterimTranscript(txt);
          processTranscript(txt);
        },
        onError: (err) => {
          if (!mountedRef.current) return;
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setPermError(
              'Mikrofon ruxsati berilmadi. Brauzer sozlamalarida ruxsat bering.',
            );
          } else if (err === 'no-speech') {
            setPermError("Ovoz eshitilmadi — qayta urinib ko'ring.");
          } else if (typeof console !== 'undefined') {
            console.warn('[SpeakWords] Web Speech STT error', err);
          }
          setPhase('idle');
        },
        onEnd: () => {
          if (!mountedRef.current) return;
          // Recognizer ended (silence / forced stop). If we haven't
          // already finished from inside processTranscript, settle.
          if (!finishedRef.current && cursorRef.current < words.length) {
            // User stopped early — finish with whatever we got, mark
            // remaining as wrong so they're shown in the fail panel.
            finishExercise();
          }
          if (mountedRef.current) {
            setPhase((prev) => (prev === 'listening' ? prev : prev));
          }
        },
      });
      listenHandleRef.current = handle;
      setPhase('listening');
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[SpeakWords] listen() threw', err);
      }
      setPermError("Brauzer ovozini boshlab bo'lmadi.");
      setPhase('idle');
    }
  }

  function stopListeningManually() {
    try {
      listenHandleRef.current?.stop();
    } catch {
      /* ignore */
    }
    if (!finishedRef.current) finishExercise();
  }

  function finishExercise() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Any word that's still pending or active when the session ends is
    // counted as wrong (the student didn't say it).
    const final = statusesRef.current.map<WordStatus>((s) =>
      s === 'pending' || s === 'active' ? 'wrong' : s,
    );
    statusesRef.current = final;
    if (mountedRef.current) setStatuses(final);

    const correctCount = final.filter((s) => s === 'correct').length;
    const score = Math.round((correctCount / words.length) * 100);
    if (mountedRef.current) setFinalScore(score);

    try {
      listenHandleRef.current?.stop();
    } catch {
      /* ignore */
    }

    if (score >= minScore) {
      if (mountedRef.current) {
        setPhase('passed');
        setShowFloater(true);
        setFloaterKey((k) => k + 1);
      }
      playSound('correct');
      setTimeout(() => {
        if (mountedRef.current) onPassed();
      }, 1700);
    } else {
      if (mountedRef.current) setPhase('failed');
      playSound('wrong');
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(120);
        }
      } catch {
        /* ignore */
      }
    }
  }

  function handleRetry() {
    const init: WordStatus[] = words.map((_, i) =>
      i === 0 ? 'active' : 'pending',
    );
    statusesRef.current = init;
    cursorRef.current = 0;
    finishedRef.current = false;
    setStatuses(init);
    setPhase('idle');
    setInterimTranscript('');
    setPermError('');
    setFinalScore(null);
  }

  /**
   * Speak a single word slowly so the student can hear the correct
   * pronunciation. Strips trailing punctuation so the synthesizer
   * doesn't add a suspicious pause for a comma.
   */
  function speakWord(word: string) {
    const clean = word.replace(/[^\p{L}\p{N}\s'-]/gu, '').trim();
    if (!clean) return;
    speak(clean, { lang: 'en-US', rate: 0.65 }).catch(() => {});
  }

  const isListening = phase === 'listening';
  const isPassed = phase === 'passed';
  const isFailed = phase === 'failed';

  // Wrong word list (display strings) for the fail panel.
  const wrongWords = words.filter((_, i) => statuses[i] === 'wrong');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot
            expression={isPassed ? 'happy' : isFailed ? 'sad' : 'idle'}
            size={48}
            animated
          />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            So&apos;zlarni navbat bilan ovozli o&apos;qing
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Mikrofon tugmasini bosing va har bir so&apos;zni aniq talaffuz qiling
          </p>
        </div>
      </div>

      {/* Word grid */}
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-5">
        <div className="flex flex-wrap gap-2 justify-center">
          {words.map((w, i) => {
            const status = statuses[i] ?? 'pending';
            const tile =
              status === 'correct'
                ? 'bg-[#dcfce7] border-[#10b981] text-[#065f46]'
                : status === 'wrong'
                  ? 'bg-[#fee2e2] border-[#ef4444] text-[#991b1b]'
                  : status === 'active'
                    ? 'bg-[#fef3c7] border-[#f59e0b] text-[#78350f] motion-safe:animate-pulse'
                    : 'bg-[#f3eedf] border-[#e8e0d0] text-[#9ca3af]';
            return (
              <span
                key={i}
                className={`inline-flex items-center px-3 py-1.5 rounded-xl border-2 border-b-[3px] text-2xl font-extrabold leading-none transition-colors duration-200 ${tile}`}
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>

      {/* Live caption while listening */}
      {isListening && (
        <div className="bg-[#fffaf0] border-[1.5px] border-[#e8e0d0] rounded-2xl px-4 py-2 min-h-[2.5rem] text-center">
          <p
            className="text-sm font-extrabold text-[#3c3c3c] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {interimTranscript || (
              <span className="text-[#cbbf9c]">Tinglanmoqda...</span>
            )}
          </p>
        </div>
      )}

      {/* Mic permission / no-speech banner */}
      {permError && (
        <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl p-3 space-y-2">
          <p
            className="text-[#991b1b] text-sm font-extrabold"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {permError}
          </p>
          <div className="flex gap-2">
            <Button variant="duo" size="sm" onClick={startListening}>
              Qayta urinish
            </Button>
            <Button variant="ghost" size="sm" onClick={onPassed}>
              O&apos;tkazib yuborish
            </Button>
          </div>
        </div>
      )}

      {/* +10 XP floater on pass */}
      {showFloater && (
        <div className="relative h-0">
          <div className="absolute right-3 -top-3 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        </div>
      )}

      {/* Pass banner */}
      {isPassed && finalScore !== null && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ajoyib talaffuz! ({finalScore}%) +10 XP
          </p>
        </div>
      )}

      {/* Fail banner + per-wrong-word pronunciation playback */}
      {isFailed && finalScore !== null && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <p
              className="text-sm font-extrabold text-[#991b1b] leading-snug"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              Aniqlik {finalScore}% — kerakli {minScore}%. Pastdagi
              so&apos;zlarni tinglab, qayta urinib ko&apos;ring.
            </p>
          </div>

          {wrongWords.length > 0 && (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#e8e0d0] p-3 space-y-2">
              <p
                className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                To&apos;g&apos;ri talaffuz
              </p>
              <div className="flex flex-wrap gap-2">
                {wrongWords.map((w, i) => (
                  <button
                    key={`${w}-${i}`}
                    type="button"
                    onClick={() => speakWord(w)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold border-2 border-b-[3px] active:translate-y-[1px] active:border-b-2 transition-all duration-150 bg-white border-[#e8e0d0] text-[#3c3c3c] hover:border-[#c8b890]"
                    style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  >
                    <Volume2 size={14} className="text-[#7a5e2c]" />
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="duo" size="lg" fullWidth onClick={handleRetry}>
              Qayta urinish
            </Button>
            <Button
              variant="duo"
              size="lg"
              className="!bg-[#ef4444] !border-[#b91c1c]"
              onClick={onFailed}
            >
              Davom etish
            </Button>
          </div>
        </div>
      )}

      {/* Mic button — hidden in passed/failed terminal states */}
      {!isPassed && !isFailed && !permError && (
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {isListening && (
              <span
                className="absolute inset-0 rounded-full bg-[#ef4444]/30 motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={isListening ? stopListeningManually : startListening}
              aria-label={isListening ? "Yozishni to'xtatish" : 'Yozib olish'}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white border-b-[6px] active:translate-y-[2px] active:border-b-[3px] transition-all duration-150 ${
                isListening
                  ? 'bg-[#ef4444] border-[#b91c1c]'
                  : 'bg-[#58cc02] border-[#46a302]'
              }`}
            >
              {isListening ? <Square size={36} fill="currentColor" /> : <Mic size={36} />}
            </button>
          </div>
          <p className="text-[#777] text-xs font-bold text-center">
            {isListening
              ? "Gapirib bo'lganingizda tugmani bosing"
              : 'Mikrofon tugmasini bosing va so’zlarni o’qishni boshlang'}
          </p>
        </div>
      )}
    </div>
  );
}

export default SpeakWords;
