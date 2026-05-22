'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { XpFloater } from './XpFloater';
import { ExplainPanel } from './ExplainPanel';
import { englishVariantsEqual } from '@/lib/english-variant';
import type { FillBlankConfig } from './exercise-types';

interface FillBlankProps {
  config: FillBlankConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'correct' | 'wrong';

const BLANK_TOKEN = '___';

/**
 * Pass 2 — Duolingo-grade fill-in-the-blank:
 *   - Sentence rendered with the `___` token replaced by an inline slot.
 *   - Two modes:
 *     • Tap-bank — when the config provides `alternatives`, distractors and
 *       correct word are shuffled into 3D pills below. Tap fills, tap-back
 *       returns. Strict match against `config.blank` (case-insensitive).
 *     • Type — when no alternatives, an inline input below the sentence.
 *       Strict match against `blank` AND `acceptedAnswers` if provided.
 *   - Correct: green pulse, chime, +10 XP floater, auto-advance.
 *   - Wrong: shake, buzz, banner with the canonical answer, "Davom etish"
 *     button (red) → onFailed.
 */
export function FillBlank({ config, onPassed, onFailed }: FillBlankProps) {
  const sentence = config.sentence ?? '';
  const blank = config.blank ?? '';
  const accepted = config.acceptedAnswers ?? [];
  // Memoize the alternatives array so the shuffle dependency is stable —
  // otherwise a new `??[]` literal every render would re-fire `useMemo`.
  const alternatives = useMemo(() => config.alternatives ?? [], [config.alternatives]);

  const isTapMode = alternatives.length > 0;

  const [selectedFromBank, setSelectedFromBank] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [shake, setShake] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Memoized shuffle of alternatives so re-renders don't reshuffle the bank.
  const shuffledBank = useMemo(() => {
    const list = [...alternatives];
    // Fisher–Yates so the order is uniform; only runs once per mount.
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, [alternatives]);

  useEffect(() => {
    if (!isTapMode) inputRef.current?.focus();
  }, [isTapMode]);

  // Defensive empty-state.
  if (!sentence || !blank || !sentence.includes(BLANK_TOKEN)) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bo&apos;sh joy topshirig&apos;i topilmadi
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Bu darsda hali bo&apos;sh joy savoli sozlanmagan.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  const currentAnswer = isTapMode ? selectedFromBank : typedAnswer.trim();
  const canSubmit = phase === 'idle' && Boolean(currentAnswer && currentAnswer.length >= 1);

  function isCorrectAnswer(value: string): boolean {
    if (!value.trim()) return false;
    // US/UK spelling variants both pass (color/colour, organise/organize).
    if (englishVariantsEqual(value, blank)) return true;
    return accepted.some((a) => englishVariantsEqual(a, value));
  }

  function handleCheck() {
    if (!canSubmit) return;
    const value = currentAnswer ?? '';
    const correct = isCorrectAnswer(value);

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

  function pickPill(word: string) {
    if (phase !== 'idle') return;
    setSelectedFromBank((prev) => (prev === word ? null : word));
  }

  function clearSlot() {
    if (phase !== 'idle') return;
    if (isTapMode) {
      setSelectedFromBank(null);
    } else {
      setTypedAnswer('');
      inputRef.current?.focus();
    }
  }

  // Split the sentence at the first `___` so we can render: leading + slot + trailing
  const blankIndex = sentence.indexOf(BLANK_TOKEN);
  const leading = sentence.slice(0, blankIndex);
  const trailing = sentence.slice(blankIndex + BLANK_TOKEN.length);

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';

  // Slot rendering: empty (dotted), filled (green underline), wrong (red).
  const slotContent = currentAnswer ?? '';
  const slotState = isCorrect
    ? 'filled-correct'
    : isWrong
      ? 'filled-wrong'
      : slotContent
        ? 'filled'
        : 'empty';

  const slotClasses = {
    empty:
      'min-w-[80px] inline-flex items-end justify-center px-2 pb-1 text-[#cbbf9c] border-b-[3px] border-dotted border-[#cbbf9c]',
    filled:
      'min-w-[80px] inline-flex items-end justify-center px-2 pb-1 text-[#3c3c3c] border-b-[3px] border-[#46a302] bg-[#dcfce7]/50 rounded-t-md',
    'filled-correct':
      'min-w-[80px] inline-flex items-end justify-center px-2 pb-1 text-[#065f46] border-b-[3px] border-[#10b981] bg-[#dcfce7] rounded-t-md',
    'filled-wrong':
      'min-w-[80px] inline-flex items-end justify-center px-2 pb-1 text-[#991b1b] border-b-[3px] border-[#ef4444] bg-[#fee2e2] rounded-t-md',
  } as const;

  return (
    <div className="space-y-4">
      {/* Header — Aloqush + eyebrow */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot expression={isCorrect ? 'happy' : isWrong ? 'sad' : 'idle'} size={48} animated />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Bo&apos;sh joyni to&apos;ldiring
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            {isTapMode ? "So'zlardan tanlang" : "So'zni yozing"}
          </p>
        </div>
      </div>

      {/* Sentence card with inline slot */}
      <div
        className={`bg-white rounded-3xl border-[1.5px] px-4 py-7 transition-colors duration-200 ${
          isCorrect
            ? 'border-[#10b981] bg-[#dcfce7]/30 motion-safe:[animation:pop_500ms_ease-out]'
            : isWrong
              ? 'border-[#ef4444]'
              : 'border-[#e8e0d0]'
        } ${shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''}`}
        onAnimationEnd={() => setShake(false)}
      >
        <p
          className="text-2xl font-extrabold text-[#3c3c3c] text-center leading-relaxed"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {leading}
          {/* Inline slot */}
          {isTapMode ? (
            <button
              type="button"
              onClick={clearSlot}
              disabled={phase !== 'idle' || !slotContent}
              aria-label={slotContent ? `Tanlangan: ${slotContent}` : "Bo'sh joy"}
              className={`mx-1 align-baseline ${slotClasses[slotState]} ${
                phase === 'idle' && slotContent ? 'hover:opacity-80' : 'cursor-default'
              }`}
            >
              {slotContent || '_____'}
            </button>
          ) : (
            <span
              className={`mx-1 align-baseline ${slotClasses[slotState]} ${
                slotContent ? '' : 'select-none'
              }`}
            >
              {slotContent || '_____'}
            </span>
          )}
          {trailing}
        </p>
      </div>

      {/* Answer surface — pills (tap mode) OR input (type mode) */}
      <div className="relative">
        {isTapMode ? (
          <div className="bg-[#f7f4ef] rounded-2xl border-[1.5px] border-[#e8e0d0] p-3 flex flex-wrap gap-2 items-start content-start min-h-[68px]">
            {shuffledBank.map((word) => {
              const taken = selectedFromBank === word;
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => pickPill(word)}
                  disabled={phase !== 'idle'}
                  aria-pressed={taken}
                  className={`px-4 py-2 rounded-2xl border-2 border-b-[4px] font-bold text-sm transition-all duration-150 ${
                    taken
                      ? 'bg-[#ddf4ff] border-[#1cb0f6] text-[#0c6c8f]'
                      : 'bg-white border-[#e8e0d0] text-[#3c3c3c] hover:border-[#c8b890]'
                  } ${
                    phase === 'idle'
                      ? 'active:translate-y-[2px] active:border-b-2'
                      : 'cursor-default'
                  }`}
                  style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                >
                  {word}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={`rounded-2xl border-2 border-b-[4px] transition-colors duration-200 ${
              isCorrect
                ? 'border-[#10b981] bg-[#dcfce7]'
                : isWrong
                  ? 'border-[#ef4444] bg-[#fee2e2]'
                  : 'border-[#e8e0d0] bg-white focus-within:border-[#58cc02]'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              value={typedAnswer}
              onChange={(e) => setTypedAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) {
                  e.preventDefault();
                  handleCheck();
                }
              }}
              maxLength={60}
              disabled={phase !== 'idle'}
              placeholder="Javob..."
              aria-label="Bo'sh joy javobi"
              className="w-full bg-transparent rounded-2xl px-4 py-3 text-lg font-bold text-[#3c3c3c] outline-none placeholder:text-[#cbbf9c] disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            />
          </div>
        )}

        {/* +10 XP floater */}
        {showFloater && (
          <div className="absolute right-3 -top-3 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        )}
      </div>

      {/* Correct banner */}
      {isCorrect && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ajoyib!
          </p>
        </div>
      )}

      {/* Wrong banner + ExplainPanel + secondary "Davom etish" red button */}
      {isWrong && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <p
              className="text-sm font-extrabold text-[#991b1b] leading-snug"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              To&apos;g&apos;ri javob: {blank}
            </p>
          </div>
          <ExplainPanel
            exerciseType="fill_blank"
            question={sentence}
            studentAnswer={currentAnswer ?? ''}
            correctAnswer={blank}
          />
          <Button
            variant="duo"
            size="lg"
            fullWidth
            className="!bg-[#ef4444] !border-[#b91c1c]"
            onClick={onFailed}
          >
            Davom etish
          </Button>
        </div>
      )}

      {/* TEKSHIRISH CTA */}
      {!isWrong && !isCorrect && (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={handleCheck}
        >
          TEKSHIRISH
        </Button>
      )}
    </div>
  );
}

export default FillBlank;
