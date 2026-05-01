'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { XpFloater } from './XpFloater';
import type { MatchPairsConfig } from './exercise-types';

interface MatchPairsProps {
  config: MatchPairsConfig;
  onPassed: () => void;
  onFailed: () => void;
}

/** A single tile in either column. `id` matches the original pair index, so a
 *  left tile and its correct right tile share the same id. */
interface Tile {
  id: number;
  label: string;
}

type Phase = 'playing' | 'completed';
/** Transient flash state: 'green' = matched, 'red' = mismatched. The `ids`
 *  array tracks which tiles to flash on a given side. */
type Flash = { side: 'left' | 'right'; ids: number[]; color: 'green' | 'red' } | null;

/** Fisher-Yates shuffle. Returns a new array; does NOT mutate input. */
function fisherYates<T>(input: T[]): T[] {
  const list = [...input];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * Pass 4 (D) — Match Pairs (memory game):
 *   - Two columns side-by-side: English (left) and Uzbek (right). Each column
 *     is shuffled independently with Fisher–Yates, memoized so re-renders
 *     don't reshuffle.
 *   - Tap a left tile → it gets a blue ring (selected). Tap a right tile:
 *     - Correct match → both flash green + chime + +XP floater + dim/disappear.
 *     - Wrong → both flash red shake + buzz; selection clears. No hearts loss
 *       (puzzle mode — never calls onFailed). A wrong-counter is shown as a
 *       gentle hint but doesn't block progress.
 *   - When all pairs matched → onPassed() after a 800ms celebration delay.
 *   - Defensive: <2 pairs OR any pair missing left/right → SkipPanel.
 */
export function MatchPairs({ config, onPassed, onFailed }: MatchPairsProps) {
  // _onFailed is part of the shared Exercise prop contract so the lesson
  // runner can decrement hearts on other exercises. MatchPairs is a puzzle
  // mode — wrong taps don't deduct hearts — but we keep the prop so the
  // wiring stays uniform.
  void onFailed;

  const pairs = Array.isArray(config?.pairs) ? config.pairs : [];
  const malformed =
    pairs.length < 2 ||
    pairs.some(
      (p) => !p || typeof p.left !== 'string' || typeof p.right !== 'string' || !p.left.trim() || !p.right.trim(),
    );

  // Always declare hooks before any early return so React's hook order is
  // stable across renders (passing `pairs` as deps means a malformed pair
  // list still produces stable hooks, just over an empty array).
  const shuffledLeft = useMemo<Tile[]>(
    () => fisherYates(pairs.map((p, i) => ({ id: i, label: p.left }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairs.length],
  );
  const shuffledRight = useMemo<Tile[]>(
    () => fisherYates(pairs.map((p, i) => ({ id: i, label: p.right }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pairs.length],
  );

  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [selectedLeftId, setSelectedLeftId] = useState<number | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);

  // Auto-clear the wrong flash after the shake animation finishes so subsequent
  // attempts use the standard idle styling.
  useEffect(() => {
    if (flash?.color !== 'red') return;
    const t = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(t);
  }, [flash]);

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
          Juftliklar topshirig&apos;ida yetarli ma&apos;lumot yo&apos;q.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  function handleTap(side: 'left' | 'right', id: number) {
    if (phase !== 'playing') return;
    if (matched.has(id)) return;
    // Don't accept new taps mid-flash so animations aren't interrupted.
    if (flash !== null) return;

    if (side === 'left') {
      setSelectedLeftId(id);
      // If a right tile was already preselected (rare since we clear on right
      // mismatch), evaluate immediately.
      if (selectedRightId !== null) {
        evaluatePair(id, selectedRightId);
      }
      return;
    }

    // side === 'right'
    if (selectedLeftId === null) {
      // Allow preselecting the right side too — feels more flexible.
      setSelectedRightId(id);
      return;
    }
    evaluatePair(selectedLeftId, id);
  }

  function evaluatePair(leftId: number, rightId: number) {
    if (leftId === rightId) {
      // Correct match.
      setFlash({ side: 'left', ids: [leftId], color: 'green' });
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
      // Commit the match a hair after the green flash so the user sees the
      // celebration before the tile dims out of the grid.
      setTimeout(() => {
        setMatched((prev) => {
          const next = new Set(prev);
          next.add(leftId);
          // Trigger completion when this match was the last one.
          if (next.size === pairs.length) {
            setPhase('completed');
            playSound('complete');
            setTimeout(onPassed, 800);
          }
          return next;
        });
        setSelectedLeftId(null);
        setSelectedRightId(null);
        setFlash(null);
      }, 350);
    } else {
      // Wrong match — flash red shake but keep both tiles in play.
      setFlash({ side: 'left', ids: [leftId, rightId], color: 'red' });
      playSound('wrong');
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(80);
        }
      } catch {
        /* ignore */
      }
      setWrongCount((c) => c + 1);
      // Clear selection so the user can try again immediately after the flash
      // resolves (the useEffect above clears `flash` after 450ms).
      setSelectedLeftId(null);
      setSelectedRightId(null);
    }
  }

  const matchedCount = matched.size;
  const totalPairs = pairs.length;
  const isCompleted = phase === 'completed';

  // Build per-tile style classes once per render; cuts the JSX clutter below.
  function tileClass(side: 'left' | 'right', id: number): string {
    const base =
      "relative flex items-center justify-center text-center bg-white border-2 border-[#e8e0d0] border-b-[4px] rounded-2xl px-3 py-4 text-base font-extrabold text-[#3c3c3c] min-h-[64px] transition-all duration-150";
    if (matched.has(id)) {
      return `${base} opacity-30 pointer-events-none border-[#bbf7d0] bg-[#dcfce7] text-[#065f46]`;
    }
    const selected =
      (side === 'left' && selectedLeftId === id) ||
      (side === 'right' && selectedRightId === id);
    const flashing = flash && flash.ids.includes(id);
    if (flashing && flash?.color === 'green') {
      return `${base} bg-[#dcfce7] border-[#10b981] text-[#065f46] motion-safe:[animation:pop_500ms_ease-out]`;
    }
    if (flashing && flash?.color === 'red') {
      return `${base} bg-[#fee2e2] border-[#ef4444] text-[#991b1b] motion-safe:[animation:shake_0.4s_ease-in-out]`;
    }
    if (selected) {
      return `${base} bg-[#ddf4ff] border-[#1cb0f6] text-[#0c6c8f] ring-2 ring-[#1cb0f6]/40`;
    }
    return `${base} hover:border-[#c8b890] active:translate-y-[2px] active:border-b-2`;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot
            expression={isCompleted ? 'happy' : 'idle'}
            size={48}
            animated
          />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Juftlikni toping
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Inglizcha so&apos;z va tarjimasini ulang
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {shuffledLeft.map((tile) => (
            <button
              key={`l-${tile.id}`}
              type="button"
              onClick={() => handleTap('left', tile.id)}
              disabled={matched.has(tile.id) || isCompleted}
              aria-pressed={selectedLeftId === tile.id}
              aria-label={`Inglizcha: ${tile.label}`}
              className={tileClass('left', tile.id)}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              <span className="leading-tight">{tile.label}</span>
              {matched.has(tile.id) && (
                <CheckCircle2
                  size={16}
                  className="absolute top-1.5 right-1.5 text-[#10b981]"
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {shuffledRight.map((tile) => (
            <button
              key={`r-${tile.id}`}
              type="button"
              onClick={() => handleTap('right', tile.id)}
              disabled={matched.has(tile.id) || isCompleted}
              aria-pressed={selectedRightId === tile.id}
              aria-label={`Tarjima: ${tile.label}`}
              className={tileClass('right', tile.id)}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              <span className="leading-tight">{tile.label}</span>
              {matched.has(tile.id) && (
                <CheckCircle2
                  size={16}
                  className="absolute top-1.5 right-1.5 text-[#10b981]"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom progress + nudges */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <span
          className="text-xs font-extrabold text-[#7a5e2c] bg-[#f3eedf] border border-[#e8e0d0] px-3 py-1.5 rounded-full"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {matchedCount}/{totalPairs} juftlik
        </span>
        {wrongCount >= 3 && !isCompleted && (
          <span
            className="text-[11px] font-bold text-[#a16207] bg-[#fef3c7] border border-[#fde68a] px-2.5 py-1 rounded-full"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Yana harakat qiling
          </span>
        )}
      </div>

      {/* +10 XP floater on each correct match */}
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

      {/* Completion banner */}
      {isCompleted && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <Sparkles size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Hammasi to&apos;g&apos;ri! Ajoyib!
          </p>
        </div>
      )}
    </div>
  );
}

export default MatchPairs;
