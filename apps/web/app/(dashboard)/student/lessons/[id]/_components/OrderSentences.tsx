'use client';
import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { XpFloater } from './XpFloater';
import { ExplainPanel } from './ExplainPanel';
import type { OrderSentencesConfig } from './exercise-types';

interface OrderSentencesProps {
  config: OrderSentencesConfig;
  onPassed: () => void;
  onFailed: () => void;
}

interface Card {
  /** Stable id derived from original-index in the correct array. Used as key
   *  and as the canonical "what is the right position for this card" anchor.
   *  e.g. card with id=2 is correct iff it ends up in slot index 2. */
  id: number;
  text: string;
}

type Phase = 'idle' | 'correct' | 'wrong';

/**
 * Pass 2 — Duolingo-grade sentence-ordering:
 *   - Top: N numbered slots. Each starts empty (dotted border) and turns
 *     green when filled.
 *   - Bottom: shuffled pool of sentence cards. Tap a pool card → it flies
 *     into the first empty slot. Tap a slotted card → it returns to the
 *     pool. Tap-only model so the flow is touch-friendly without a DnD lib.
 *   - TEKSHIRISH disabled until every slot is filled.
 *   - Correct: green pulse + chime + +10 XP floater + auto-advance.
 *   - Wrong: shake + buzz + diff-highlight (which slot positions are wrong),
 *     then "Davom etish" → onFailed.
 */
export function OrderSentences({ config, onPassed, onFailed }: OrderSentencesProps) {
  const correctOrder = useMemo(
    () => (config.sentences ?? []).filter((s) => s && s.trim().length > 0),
    [config.sentences],
  );
  const slotCount = correctOrder.length;

  // Build the canonical card list once: id = correct-position. The pool is
  // a Fisher–Yates shuffle of these cards, memoized so re-renders don't
  // reshuffle and disorient the student.
  const initialCards = useMemo<Card[]>(
    () => correctOrder.map((text, i) => ({ id: i, text })),
    [correctOrder],
  );

  const initialPool = useMemo<Card[]>(() => {
    const list = [...initialCards];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // Edge case: if shuffle produced the original order, swap first two so
    // the student always sees a non-trivial puzzle.
    if (list.length >= 2 && list.every((c, i) => c.id === i)) {
      [list[0], list[1]] = [list[1], list[0]];
    }
    return list;
  }, [initialCards]);

  const [pool, setPool] = useState<Card[]>(initialPool);
  const [slots, setSlots] = useState<(Card | null)[]>(() => Array(slotCount).fill(null));
  const [phase, setPhase] = useState<Phase>('idle');
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [shake, setShake] = useState(false);

  // Defensive empty-state.
  if (slotCount < 2) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Tartiblash topshirig&apos;i topilmadi
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Bu darsda hali tartiblash savoli sozlanmagan.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  const allFilled = slots.every((s) => s !== null);
  const filledCount = slots.filter((s) => s !== null).length;

  // Per-slot correctness: filled card with id matching its index.
  const slotMatches = slots.map((c, i) => (c ? c.id === i : false));

  function placeFromPool(card: Card) {
    if (phase !== 'idle') return;
    const firstEmpty = slots.findIndex((s) => s === null);
    if (firstEmpty === -1) return;
    const next = [...slots];
    next[firstEmpty] = card;
    setSlots(next);
    setPool((prev) => prev.filter((p) => p.id !== card.id));
  }

  function returnToPool(slotIdx: number) {
    if (phase !== 'idle') return;
    const card = slots[slotIdx];
    if (!card) return;
    const next = [...slots];
    next[slotIdx] = null;
    setSlots(next);
    setPool((prev) => [...prev, card]);
  }

  function checkAnswer() {
    if (!allFilled || phase !== 'idle') return;
    const correct = slots.every((c, i) => c?.id === i);

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

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';

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
            Jumlalarni to&apos;g&apos;ri tartibda joylashtiring
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            {filledCount} / {slotCount} joylashtirilgan
          </p>
        </div>
      </div>

      {/* Slot row — numbered N rows */}
      <div className="relative">
        <div
          className={`space-y-2 rounded-2xl p-3 transition-colors duration-200 ${
            isCorrect
              ? 'bg-[#dcfce7] motion-safe:[animation:pop_500ms_ease-out]'
              : isWrong
                ? 'bg-[#fee2e2]'
                : 'bg-transparent'
          } ${shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''}`}
          onAnimationEnd={() => setShake(false)}
        >
          {slots.map((card, i) => {
            const filled = card !== null;
            const wrongHere = isWrong && filled && !slotMatches[i];
            const correctHere = isCorrect || (isWrong && filled && slotMatches[i]);

            // Border & badge color based on slot state.
            const borderTone = wrongHere
              ? 'border-[#ef4444] bg-[#fee2e2]'
              : correctHere
                ? 'border-[#10b981] bg-[#dcfce7]'
                : filled
                  ? 'border-[#46a302] bg-white'
                  : 'border-[#cbbf9c] bg-white border-dashed';

            const badgeTone = wrongHere
              ? 'bg-[#ef4444] text-white'
              : correctHere
                ? 'bg-[#10b981] text-white'
                : filled
                  ? 'bg-[#58cc02] text-white'
                  : 'bg-[#f3eedf] text-[#7a5e2c]';

            return (
              <div
                key={i}
                className={`flex items-stretch gap-3 rounded-2xl border-2 border-b-[4px] p-2 pl-3 transition-colors duration-150 ${borderTone}`}
              >
                <span
                  className={`shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm ${badgeTone}`}
                  style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {filled ? (
                  <button
                    type="button"
                    onClick={() => returnToPool(i)}
                    disabled={phase !== 'idle'}
                    className={`flex-1 text-left px-3 py-2 rounded-xl font-bold text-sm leading-snug ${
                      wrongHere
                        ? 'text-[#991b1b]'
                        : correctHere
                          ? 'text-[#065f46]'
                          : 'text-[#3c3c3c]'
                    } ${phase === 'idle' ? 'hover:bg-black/[0.03]' : 'cursor-default'}`}
                    style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  >
                    {card!.text}
                  </button>
                ) : (
                  <span
                    className="flex-1 px-3 py-2 text-sm font-bold text-[#cbbf9c] italic"
                    style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  >
                    Bo&apos;sh joy — pastdan tanlang
                  </span>
                )}
              </div>
            );
          })}
        </div>

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

      {/* Sentence pool */}
      <div className="bg-[#f7f4ef] rounded-2xl border-[1.5px] border-[#e8e0d0] p-3 min-h-[80px] space-y-2">
        {pool.length === 0 ? (
          <p className="text-[#cbbf9c] text-sm font-bold w-full text-center py-2">
            Hammasi joylashtirildi — TEKSHIRISH bosing
          </p>
        ) : (
          pool.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => placeFromPool(card)}
              disabled={phase !== 'idle'}
              className={`w-full text-left bg-white border-2 border-[#e8e0d0] border-b-[4px] rounded-2xl p-3 font-bold text-sm text-[#3c3c3c] transition-all duration-150 ${
                phase === 'idle'
                  ? 'active:translate-y-[2px] active:border-b-2 hover:border-[#c8b890]'
                  : 'cursor-default'
              }`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {card.text}
            </button>
          ))
        )}
      </div>

      {/* Result banner */}
      {(isCorrect || isWrong) && (
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
          {isCorrect
            ? "Ajoyib — to'g'ri tartib! +10 XP"
            : "Tartib noto'g'ri — qizil katakchalarga e'tibor bering"}
        </div>
      )}

      {/* CTA: TEKSHIRISH idle, "Davom etish" wrong */}
      {isWrong ? (
        <div className="space-y-3">
          <ExplainPanel
            exerciseType="order_sentences"
            question="Jumlalarni to'g'ri tartibda joylashtiring"
            studentAnswer={slots.map((c) => c?.text ?? '___').join(' || ')}
            correctAnswer={correctOrder.join(' || ')}
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
        !isCorrect && (
          <Button
            variant="duo"
            size="lg"
            fullWidth
            disabled={!allFilled}
            onClick={checkAnswer}
          >
            TEKSHIRISH
          </Button>
        )
      )}
    </div>
  );
}

export default OrderSentences;
