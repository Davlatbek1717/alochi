'use client';
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { XpFloater } from './XpFloater';
import { ExplainPanel } from './ExplainPanel';

interface WordOrderTestProps {
  sentences: { words: string[]; correct: string }[];
  onPassed: () => void;
  onFailed: () => void;
}

interface Pill {
  /** Stable identifier per pill so duplicates don't collide on key. */
  id: number;
  word: string;
}

/**
 * Pass 5 — Duolingo-grade word-order:
 *   - Top row shows underline-slots (one per expected word). Filled slots
 *     show their pill; empty slots show a dotted line.
 *   - Bottom row is the word bank. Tap to send a pill UP into the next
 *     empty slot. Tap a pill in the slot to send it back to the bank.
 *   - TEKSHIRISH disabled until every slot is filled.
 *   - Correct: green pulse + chime + XP floater + advance.
 *   - Wrong: shake the slot row + buzz + diff highlight on misplaced words.
 */
export function WordOrderTest({ sentences, onPassed, onFailed }: WordOrderTestProps) {
  const [current, setCurrent] = useState(0);

  const sentence = sentences[current];
  const correctTokens = useMemo(() => sentence.correct.trim().split(/\s+/), [sentence.correct]);
  const slotCount = correctTokens.length;

  // Build initial bank — each pill gets a stable id derived from index, which
  // remains unique even when the same word appears twice in the bank.
  const initialBank = useMemo<Pill[]>(
    () => sentence.words.map((w, i) => ({ id: i, word: w })),
    [sentence.words],
  );

  const [bank, setBank] = useState<Pill[]>(initialBank);
  const [slots, setSlots] = useState<(Pill | null)[]>(() => Array(slotCount).fill(null));
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [showFloater, setShowFloater] = useState(false);
  const [shake, setShake] = useState(false);

  // Reset working state when the question advances.
  function resetForSentence(nextIdx: number) {
    setCurrent(nextIdx);
    const next = sentences[nextIdx];
    setBank(next.words.map((w, i) => ({ id: i, word: w })));
    const tokens = next.correct.trim().split(/\s+/);
    setSlots(Array(tokens.length).fill(null));
    setShowResult(false);
    setIsCorrect(false);
    setShowFloater(false);
    setShake(false);
  }

  function placeFromBank(pill: Pill) {
    if (showResult) return;
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return;
    const nextSlots = [...slots];
    nextSlots[firstEmpty] = pill;
    setSlots(nextSlots);
    setBank((prev) => prev.filter((p) => p.id !== pill.id));
  }

  function returnToBank(slotIdx: number) {
    if (showResult) return;
    const pill = slots[slotIdx];
    if (!pill) return;
    const nextSlots = [...slots];
    nextSlots[slotIdx] = null;
    setSlots(nextSlots);
    setBank((prev) => [...prev, pill]);
  }

  const allFilled = slots.every((s) => s !== null);

  // Compare each slot's word against the expected token at that index. Used
  // both for the overall verdict and for the diff-highlight on wrong slots.
  const slotMatches = slots.map((s, i) => (s ? s.word === correctTokens[i] : false));

  function checkAnswer() {
    if (!allFilled || showResult) return;
    const answer = slots.map((s) => s?.word ?? '').join(' ');
    const correct = answer === sentence.correct;
    setIsCorrect(correct);
    setShowResult(true);

    if (correct) {
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
    } else {
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

    if (correct) {
      // Only auto-advance on success. Wrong path waits for the student to
      // click the red "Davom etish" CTA so they can read ExplainPanel first.
      setTimeout(() => {
        if (current + 1 < sentences.length) {
          resetForSentence(current + 1);
        } else {
          onPassed();
        }
      }, 900);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs">
        <span
          className="text-[#777] font-extrabold uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Savol {current + 1} / {sentences.length}
        </span>
        <span className="text-[#777] font-bold">
          {slots.filter((s) => s !== null).length} / {slotCount} so&apos;z
        </span>
      </div>

      {/* Instruction */}
      <p
        className="text-base font-extrabold text-[#3c3c3c] text-center leading-snug px-2"
        style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
      >
        Gapni to&apos;g&apos;ri tartibda joylashtiring
      </p>

      {/* Slot row */}
      <div className="relative">
        <div
          className={`min-h-[68px] rounded-2xl px-3 py-3 border-[1.5px] flex flex-wrap gap-x-2 gap-y-3 items-end transition-colors duration-200 ${
            showResult && isCorrect
              ? 'border-[#10b981] bg-[#dcfce7] motion-safe:[animation:pop_500ms_ease-out]'
              : showResult && !isCorrect
                ? 'border-[#ef4444] bg-[#fee2e2]'
                : 'border-[#e8e0d0] bg-white'
          } ${shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''}`}
          onAnimationEnd={() => setShake(false)}
        >
          {slots.map((pill, i) => {
            const filled = pill !== null;
            const wrongHere = showResult && !isCorrect && filled && !slotMatches[i];

            return (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[56px]">
                {filled ? (
                  <button
                    type="button"
                    onClick={() => returnToBank(i)}
                    disabled={showResult}
                    className={`px-3 py-2 rounded-2xl border-2 border-b-[4px] font-bold text-sm transition-all duration-150 ${
                      wrongHere
                        ? 'bg-[#fee2e2] text-[#991b1b] border-[#ef4444]'
                        : 'bg-[#58cc02] text-white border-[#46a302]'
                    } ${
                      !showResult ? 'active:translate-y-[2px] active:border-b-2' : 'cursor-default'
                    }`}
                    style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  >
                    {pill!.word}
                  </button>
                ) : (
                  <span
                    className="px-3 py-2 text-sm font-bold text-[#cbbf9c] select-none"
                    aria-hidden="true"
                  >
                    {' '}
                  </span>
                )}
                <div
                  className={`h-[3px] w-full rounded-full ${
                    filled
                      ? wrongHere
                        ? 'bg-[#ef4444]'
                        : 'bg-[#46a302]'
                      : 'border-b-2 border-dotted border-[#cbbf9c]'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* XP floater layered over the slot row */}
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

      {/* Word bank */}
      <div className="bg-[#f7f4ef] rounded-2xl border-[1.5px] border-[#e8e0d0] p-3 min-h-[80px] flex flex-wrap gap-2 items-start content-start">
        {bank.length === 0 ? (
          <p className="text-[#cbbf9c] text-sm font-bold w-full text-center py-2">
            Hammasi joylashtirildi — TEKSHIRISH bosing
          </p>
        ) : (
          bank.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => placeFromBank(pill)}
              disabled={showResult}
              className={`px-4 py-2 rounded-2xl border-2 border-b-[4px] bg-white border-[#e8e0d0] font-bold text-[#3c3c3c] text-sm transition-all duration-150 ${
                !showResult
                  ? 'active:translate-y-[2px] active:border-b-2 hover:border-[#c8b890]'
                  : 'cursor-default'
              }`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {pill.word}
            </button>
          ))
        )}
      </div>

      {/* Result banner */}
      {showResult && (
        <div
          className={`p-4 rounded-2xl border-[1.5px] flex items-center gap-3 font-extrabold text-sm ${
            isCorrect
              ? 'bg-[#dcfce7] border-[#bbf7d0] text-[#065f46]'
              : 'bg-[#fee2e2] border-[#fecaca] text-[#991b1b]'
          }`}
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {isCorrect ? (
            <CheckCircle2 size={20} className="text-[#10b981] shrink-0" />
          ) : (
            <XCircle size={20} className="text-[#ef4444] shrink-0" />
          )}
          {isCorrect ? "Ajoyib — to'g'ri tartib! +10 XP" : "Xato tartib — to'g'risi quyida"}
        </div>
      )}

      {/* CTA: TEKSHIRISH (idle) / Davom etish (wrong) */}
      {showResult && !isCorrect ? (
        <div className="space-y-3">
          <ExplainPanel
            exerciseType="word_order"
            question="So'zlarni to'g'ri tartibda joylashtiring"
            studentAnswer={slots.map((p) => p?.word ?? '___').join(' ')}
            correctAnswer={sentence.correct}
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
      ) : (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          disabled={!allFilled || showResult}
          onClick={checkAnswer}
        >
          TEKSHIRISH
        </Button>
      )}

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center pt-1">
        {sentences.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i < current
                ? 'bg-[#58cc02] w-2'
                : i === current
                  ? 'bg-[#fbbf24] w-6 motion-safe:[animation:pop_1.2s_ease-in-out_infinite]'
                  : 'bg-[#e8e0d0] w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
