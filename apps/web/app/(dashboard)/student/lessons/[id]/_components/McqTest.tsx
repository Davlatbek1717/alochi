'use client';
import { useRef, useState, type KeyboardEvent } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { XpFloater } from './XpFloater';

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface McqTestProps {
  questions: McqQuestion[];
  onPassed: () => void;
  onFailed: () => void;
}

/**
 * Pass 5 — Duolingo-grade MCQ:
 *   - Big tile-buttons with circular letter badges and a 3D bottom border
 *   - Select-then-check pattern (TEKSHIRISH CTA) instead of immediate-tap
 *   - Correct: green flash + ✓ + chime + +10 XP floater
 *   - Wrong: shake + buzz + reveals correct-answer banner
 */
export function McqTest({ questions, onPassed, onFailed }: McqTestProps) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [wrongs, setWrongs] = useState(0);
  const [floaterKey, setFloaterKey] = useState(0);
  const [showFloater, setShowFloater] = useState(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Filter out malformed questions (missing options/text). Server data may be
  // partial during early lesson editing — fall back gracefully instead of crashing.
  const validQuestions = questions.filter(
    (qq) => qq && Array.isArray(qq.options) && qq.options.length > 0 && qq.text,
  );

  const q = validQuestions[current];

  if (!q) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Test savollari topilmadi
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Bu darsda hali MCQ savollari sozlanmagan.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  const isCorrect = showResult && selected === q.correct;
  const isWrong = showResult && selected !== null && selected !== q.correct;

  function handleSelect(idx: number) {
    if (showResult) return;
    setSelected(idx);
  }

  function handleOptionKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (showResult) return;
    const len = q.options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % len;
      optionRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + len) % len;
      optionRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Default button behaviour selects, but we also auto-check if already selected.
      if (selected === idx) {
        e.preventDefault();
        handleCheck();
      }
    }
  }

  function handleCheck() {
    if (selected === null || showResult) return;
    setShowResult(true);

    const correct = selected === q.correct;
    if (correct) {
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
    } else {
      playSound('wrong');
      setWrongs((w) => w + 1);
      // Optional haptic buzz for supporting devices — silent no-op otherwise.
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(120);
        }
      } catch {
        /* ignore */
      }
    }

    const delay = correct ? 700 : 1500;
    setTimeout(() => {
      if (current + 1 < validQuestions.length) {
        setCurrent((c) => c + 1);
        setSelected(null);
        setShowResult(false);
        setShowFloater(false);
      } else {
        const totalWrongs = wrongs + (correct ? 0 : 1);
        if (totalWrongs === 0) {
          onPassed();
        } else {
          onFailed();
        }
      }
    }, delay);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-xs">
        <span
          className="text-[#777] font-extrabold uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Savol {current + 1} / {validQuestions.length}
        </span>
        {wrongs > 0 && (
          <span className="flex items-center gap-1 text-[#ef4444] font-extrabold bg-[#fee2e2] border border-[#fecaca] px-2.5 py-1 rounded-full">
            <XCircle size={12} /> {wrongs} ta xato
          </span>
        )}
      </div>

      {/* Question prompt */}
      <p
        className="text-2xl font-extrabold text-[#3c3c3c] text-center leading-snug px-2"
        style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
      >
        {q.text}
      </p>

      {/* Tile-buttons */}
      <div className="space-y-3 relative">
        {q.options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrectOpt = idx === q.correct;

          let tileStyle =
            'bg-white border-[#e8e0d0] text-[#3c3c3c] hover:border-[#c8b890]';
          if (!showResult && isSelected) {
            tileStyle =
              'bg-[#ddf4ff] border-[#1cb0f6] text-[#0c6c8f]';
          }
          if (showResult && isCorrectOpt) {
            tileStyle = 'bg-[#dcfce7] border-[#10b981] text-[#065f46]';
          } else if (showResult && isSelected && !isCorrectOpt) {
            tileStyle =
              'bg-[#fee2e2] border-[#ef4444] text-[#991b1b] motion-safe:[animation:shake_0.4s_ease-in-out]';
          } else if (showResult) {
            tileStyle = 'bg-white border-[#e8e0d0] text-[#9ca3af] opacity-70';
          }

          const badgeStyle =
            !showResult && isSelected
              ? 'border-[#1cb0f6] text-[#1cb0f6]'
              : showResult && isCorrectOpt
                ? 'border-[#10b981] text-[#10b981] bg-white'
                : showResult && isSelected && !isCorrectOpt
                  ? 'border-[#ef4444] text-[#ef4444] bg-white'
                  : 'border-[#e8e0d0] text-[#777]';

          return (
            <button
              key={idx}
              ref={(el) => {
                optionRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => handleSelect(idx)}
              onKeyDown={(e) => handleOptionKeyDown(e, idx)}
              disabled={showResult}
              aria-pressed={isSelected}
              aria-label={`${String.fromCharCode(65 + idx)}: ${opt}`}
              className={`w-full min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-b-[4px] font-bold text-base text-left transition-all duration-150 ${tileStyle} ${
                !showResult ? 'active:translate-y-[2px] active:border-b-2' : ''
              } disabled:cursor-default`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              <span
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-extrabold text-sm shrink-0 transition-colors ${badgeStyle}`}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1">{opt}</span>
              {showResult && isCorrectOpt && (
                <CheckCircle2 size={20} className="text-[#10b981] shrink-0" />
              )}
              {showResult && isSelected && !isCorrectOpt && (
                <XCircle size={20} className="text-[#ef4444] shrink-0" />
              )}
            </button>
          );
        })}

        {/* +10 XP floater layered over the tile area */}
        {showFloater && (
          <div className="absolute right-3 top-1 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        )}
      </div>

      {/* Wrong-answer banner */}
      {isWrong && (
        <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
          <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
          <p
            className="text-sm font-extrabold text-[#991b1b] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            To&apos;g&apos;ri javob: {q.options[q.correct]}
          </p>
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

      {/* Sticky check CTA */}
      <Button
        variant="duo"
        size="lg"
        fullWidth
        disabled={selected === null || showResult}
        onClick={handleCheck}
      >
        TEKSHIRISH
      </Button>

      {/* Progress dots — active dot pulses */}
      <div className="flex gap-1.5 justify-center pt-1">
        {validQuestions.map((_, i) => (
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
