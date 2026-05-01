'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Delete,
  Loader2,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getTtsAudio } from '@/lib/exercises';
import { XpFloater } from './XpFloater';
import type { SpellingConfig } from './exercise-types';

interface SpellingProps {
  config: SpellingConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'correct' | 'wrong';
type AudioState = 'idle' | 'loading' | 'playing' | 'error';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MAX_LEN = 30;

/** A single position in the rendered word — either an input slot the
 * student must fill, or a fixed character (hyphen / space / apostrophe)
 * that stays visible at all times. */
type Slot =
  | { kind: 'input'; targetLetter: string; index: number }
  | { kind: 'fixed'; char: string };

/**
 * Pass 3 (G) — Spelling drill:
 *   - Optional play-audio button at the top (auto-plays once on mount when
 *     `config.audioPlay !== false`).
 *   - Word rendered as N letter slots; punctuation/spaces are baked in as
 *     non-input fixed cells so the student only types the letters.
 *   - Below: tappable a-z keyboard (5 columns) + a Backspace tile. Tap a
 *     letter to fill the next empty slot; Backspace removes the most recent.
 *   - Strict case-insensitive grade once every input slot is filled.
 *   - Wrong: shake every slot, reveal the correct word above; secondary
 *     red "Davom etish" → onFailed.
 *   - Defensive: empty / >30-char words short-circuit to a SkipPanel.
 */
export function SpellingDrill({ config, onPassed, onFailed }: SpellingProps) {
  const word = (config?.word ?? '').trim();
  const audioPlay = config?.audioPlay !== false;
  const inputSlotCount = useMemo(
    () => Array.from(word).filter((c) => /[a-z]/i.test(c)).length,
    [word],
  );
  const malformed = !word || word.length > MAX_LEN || inputSlotCount === 0;

  const [letters, setLetters] = useState<string[]>([]); // typed letters, in input-slot order
  const [phase, setPhase] = useState<Phase>('idle');
  const [shake, setShake] = useState(false);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorVisible, setAudioErrorVisible] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const autoplayedRef = useRef(false);
  const mountedRef = useRef(true);
  // Latest `handleCheck` ref so the global keydown listener can call the
  // current closure without retriggering the listener on every render.
  const handleCheckRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const a = audioElementRef.current;
      if (a) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
        a.onplay = null;
        a.onended = null;
        a.onerror = null;
        audioElementRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (malformed || !audioPlay || autoplayedRef.current) return;
    autoplayedRef.current = true;
    const t = setTimeout(() => {
      void playAudio();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malformed, audioPlay]);

  // Hardware keyboard support — power users (and keyboard-first a11y) can
  // type the word directly; a-z fills slots, Backspace removes, Enter checks.
  // Must be declared before the malformed early-return so React's hook order
  // stays consistent across renders.
  useEffect(() => {
    if (malformed) return;
    function onKey(e: KeyboardEvent) {
      if (phase !== 'idle') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (/^[a-zA-Z]$/.test(key)) {
        e.preventDefault();
        setLetters((prev) =>
          prev.length >= inputSlotCount ? prev : [...prev, key.toLowerCase()],
        );
      } else if (key === 'Backspace') {
        e.preventDefault();
        setLetters((prev) => prev.slice(0, -1));
      } else if (key === 'Enter' && letters.length === inputSlotCount) {
        e.preventDefault();
        handleCheckRef.current?.();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, letters, inputSlotCount, malformed]);

  // Build the slot array from the configured word. Memoized on `word` so the
  // structure is stable across re-renders.
  const slots = useMemo<Slot[]>(() => {
    let i = 0;
    return Array.from(word).map<Slot>((c) => {
      if (/[a-z]/i.test(c)) {
        return { kind: 'input', targetLetter: c, index: i++ };
      }
      return { kind: 'fixed', char: c };
    });
  }, [word]);

  async function playAudio() {
    if (audioState === 'loading') return;
    if (audioElementRef.current) {
      try {
        audioElementRef.current.currentTime = 0;
        await audioElementRef.current.play();
      } catch {
        /* ignore */
      }
      return;
    }
    setAudioState('loading');
    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';
    try {
      const res = await getTtsAudio(word, 'en', token);
      if (!res?.audioBase64) {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
        return;
      }
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onplay = () => {
        if (mountedRef.current) setAudioState('playing');
      };
      audio.onended = () => {
        if (mountedRef.current) setAudioState('idle');
      };
      audio.onerror = () => {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
      };
      audioElementRef.current = audio;
      await audio.play();
    } catch {
      if (mountedRef.current) {
        setAudioState('error');
        setAudioErrorVisible(true);
      }
    }
  }

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
          Imlo so&apos;zi noto&apos;g&apos;ri formatda.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  function pressLetter(letter: string) {
    if (phase !== 'idle') return;
    setLetters((prev) => {
      if (prev.length >= inputSlotCount) return prev;
      return [...prev, letter];
    });
  }

  function pressBackspace() {
    if (phase !== 'idle') return;
    setLetters((prev) => prev.slice(0, -1));
  }

  function handleCheck() {
    if (letters.length !== inputSlotCount || phase !== 'idle') return;
    const target = slots
      .filter((s): s is Extract<Slot, { kind: 'input' }> => s.kind === 'input')
      .map((s) => s.targetLetter)
      .join('')
      .toLowerCase();
    const guessed = letters.join('').toLowerCase();
    const correct = guessed === target;

    if (correct) {
      setPhase('correct');
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
      setTimeout(() => onPassed(), 1300);
    } else {
      setPhase('wrong');
      playSound('wrong');
      setShake(true);
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(120);
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Keep handleCheckRef pointing at the most recent handleCheck closure so
  // the keydown listener (registered above) can fire it without re-binding.
  handleCheckRef.current = handleCheck;

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';
  const canSubmit = letters.length === inputSlotCount && phase === 'idle';
  const currentInputIndex = letters.length; // next empty input slot
  const isPlaying = audioState === 'playing';
  const isLoading = audioState === 'loading';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot
            expression={isCorrect ? 'happy' : isWrong ? 'sad' : 'idle'}
            size={48}
            animated
          />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            So&apos;zni harf-harf yozing
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Eshiting va to&apos;g&apos;ri imlo bilan kiriting
          </p>
        </div>
      </div>

      {/* Optional play button */}
      {audioPlay && (
        <div className="flex flex-col items-center gap-2 py-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {isPlaying && (
              <span
                className="absolute inset-0 rounded-full bg-[#58cc02]/40 motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={playAudio}
              disabled={isLoading}
              aria-label={isPlaying ? 'Audio o‘ynamoqda' : 'Audioni qayta o‘ynatish'}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white border-b-[6px] active:translate-y-[2px] active:border-b-[3px] transition-all duration-150 disabled:opacity-80 disabled:cursor-wait ${
                audioState === 'error'
                  ? 'bg-[#9ca3af] border-[#6b7280]'
                  : 'bg-[#58cc02] border-[#46a302]'
              }`}
            >
              {isLoading ? (
                <Loader2 size={36} className="animate-spin" />
              ) : audioState === 'error' ? (
                <VolumeX size={36} />
              ) : (
                <Volume2 size={36} />
              )}
            </button>
          </div>
          <p className="text-[11px] font-bold text-[#777]">
            {isPlaying
              ? 'Tinglanmoqda...'
              : isLoading
                ? 'Yuklanmoqda...'
                : audioState === 'error'
                  ? 'Audio mavjud emas'
                  : 'Qayta tinglash uchun bosing'}
          </p>
        </div>
      )}

      {audioPlay && audioErrorVisible && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#d97706] shrink-0 mt-0.5" />
          <p
            className="text-xs font-bold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Audio yuklab bo&apos;lmadi — so&apos;z:{' '}
            <span className="font-extrabold">{word}</span>
          </p>
        </div>
      )}

      {/* Reveal correct word above slots when wrong */}
      {isWrong && (
        <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-center gap-2">
          <XCircle size={18} className="text-[#ef4444] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#991b1b]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            To&apos;g&apos;ri javob: {word}
          </p>
        </div>
      )}

      {/* Slot row */}
      <div
        className={`flex flex-wrap justify-center gap-1.5 py-2 ${
          shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''
        }`}
        onAnimationEnd={() => setShake(false)}
      >
        {slots.map((slot, i) => {
          if (slot.kind === 'fixed') {
            // Render space as a visible thin gap, others as plain glyphs.
            if (slot.char === ' ') {
              return (
                <span
                  key={`fix-${i}`}
                  aria-hidden="true"
                  className="w-3 h-14"
                />
              );
            }
            return (
              <span
                key={`fix-${i}`}
                className="w-6 h-14 flex items-end justify-center text-2xl font-extrabold text-[#7a5e2c]"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                aria-hidden="true"
              >
                {slot.char}
              </span>
            );
          }
          const filled = letters[slot.index];
          const isFocus = phase === 'idle' && slot.index === currentInputIndex;
          let cellStyle =
            'bg-[#fffaf0] border-[#e8e0d0] border-b-[4px] text-[#3c3c3c]';
          if (isFocus) {
            cellStyle =
              'bg-white border-[#58cc02] border-b-[4px] text-[#3c3c3c] motion-safe:[animation:pop_700ms_ease-in-out_infinite]';
          }
          if (isCorrect) {
            cellStyle =
              'bg-[#dcfce7] border-[#10b981] border-b-[4px] text-[#065f46]';
          } else if (isWrong) {
            const wasWrong =
              filled !== undefined &&
              filled.toLowerCase() !== slot.targetLetter.toLowerCase();
            cellStyle = wasWrong
              ? 'bg-[#fee2e2] border-[#ef4444] border-b-[4px] text-[#991b1b]'
              : 'bg-[#fffaf0] border-[#e8e0d0] border-b-[4px] text-[#3c3c3c]';
          }
          return (
            <span
              key={`in-${slot.index}`}
              className={`w-12 h-14 flex items-center justify-center rounded-xl border-2 text-2xl font-extrabold transition-colors ${cellStyle}`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              aria-label={
                filled
                  ? `Harf ${slot.index + 1}: ${filled}`
                  : `Bo'sh harf ${slot.index + 1}`
              }
            >
              {filled ?? ''}
            </span>
          );
        })}
      </div>

      {/* Virtual a-z keyboard */}
      <div className="bg-[#f7f4ef] rounded-2xl border-[1.5px] border-[#e8e0d0] p-3 space-y-2">
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => pressLetter(letter)}
              disabled={phase !== 'idle' || letters.length >= inputSlotCount}
              className="h-11 rounded-xl bg-white border-2 border-b-[4px] border-[#e8e0d0] text-[#3c3c3c] text-base font-extrabold uppercase active:translate-y-[2px] active:border-b-2 disabled:opacity-50 disabled:cursor-default transition-all"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              aria-label={`Harf ${letter.toUpperCase()}`}
            >
              {letter}
            </button>
          ))}
          <button
            type="button"
            onClick={pressBackspace}
            disabled={phase !== 'idle' || letters.length === 0}
            className="h-11 col-span-2 rounded-xl bg-white border-2 border-b-[4px] border-[#e8e0d0] text-[#3c3c3c] text-xs font-extrabold uppercase flex items-center justify-center gap-1 active:translate-y-[2px] active:border-b-2 disabled:opacity-50 disabled:cursor-default transition-all"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            aria-label="O'chirish"
          >
            <Delete size={16} />
            O&apos;CH
          </button>
        </div>
      </div>

      {/* +10 XP floater */}
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

      {/* Correct banner */}
      {isCorrect && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ajoyib! +10 XP
          </p>
        </div>
      )}

      {/* CTAs */}
      {isWrong ? (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          className="!bg-[#ef4444] !border-[#b91c1c]"
          onClick={onFailed}
        >
          Davom etish
        </Button>
      ) : !isCorrect ? (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={handleCheck}
        >
          TEKSHIRISH
        </Button>
      ) : null}
    </div>
  );
}

export default SpellingDrill;
