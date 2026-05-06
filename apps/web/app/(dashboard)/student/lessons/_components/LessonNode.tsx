'use client';
import { Check, Lock, Play } from 'lucide-react';
import { forwardRef, type CSSProperties } from 'react';

export type NodeState = 'locked' | 'current' | 'completed';

interface Props {
  state: NodeState;
  /** 1-indexed position within the unit (1..5) — used for the node number when locked/current. */
  positionLabel: number;
  /** Optional unit colour override (used by the current/active node ring). Falls back to green. */
  accentColor?: string;
  /** Optional darker shadow side (3D press) — pairs with accentColor for the bottom border. */
  accentShadow?: string;
  /** Click handler — only invoked when state is "current" or "completed". */
  onClick?: () => void;
  /** Inline style — used by the parent path layout to absolute-position the node. */
  style?: CSSProperties;
  /** Aria label for screen readers (lesson title). */
  ariaLabel?: string;
}

/**
 * LessonNode — single circular node on the Duolingo-style snake path.
 *
 * States:
 *  - locked     : grey body, lock icon, not pressable.
 *  - current    : larger, accent-coloured, pulse-ring behind, "BOSHLASH" label below.
 *                 Renders a play arrow icon.
 *  - completed  : gold body with checkmark; gold-bordered ring.
 *
 * 3D depth comes from a thicker bottom border (`border-b-[Npx]`) plus an
 * `active:translate-y-[2px]` press feedback for available nodes.
 */
export const LessonNode = forwardRef<HTMLButtonElement, Props>(function LessonNode(
  {
    state,
    positionLabel,
    accentColor = '#58cc02',
    accentShadow = '#46a302',
    onClick,
    style,
    ariaLabel,
  },
  ref,
) {
  const isLocked = state === 'locked';
  const isCurrent = state === 'current';
  const isCompleted = state === 'completed';

  const sizeClass = isCurrent ? 'w-[100px] h-[100px]' : 'w-20 h-20';

  const bodyClass = isLocked
    ? 'bg-[#e5e5e5] text-[#a0a0a0] border-2 border-[#d4d4d4]'
    : isCompleted
      ? 'bg-[#fbbf24] text-white border-b-[4px] border-[#d97706]'
      : 'text-white border-b-[6px]';

  const bodyStyle: CSSProperties | undefined =
    isCurrent
      ? { backgroundColor: accentColor, borderBottomColor: accentShadow }
      : undefined;

  const innerIcon = isLocked ? (
    <Lock size={28} strokeWidth={2.5} />
  ) : isCompleted ? (
    <Check size={36} strokeWidth={3.5} />
  ) : (
    <Play size={40} strokeWidth={2.5} className="ml-1" fill="currentColor" />
  );

  const buttonClasses = [
    'relative rounded-full font-extrabold flex items-center justify-center select-none',
    'transition-all duration-150',
    sizeClass,
    bodyClass,
    isLocked ? 'cursor-not-allowed' : 'cursor-pointer active:translate-y-[2px]',
    !isLocked ? 'shadow-[0_4px_0_rgba(0,0,0,0.06)]' : '',
    isCurrent ? 'active:border-b-[4px]' : isCompleted ? 'active:border-b-[2px]' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="relative flex flex-col items-center gap-2"
      style={style}
    >
      {/* Pulse ring for current node — sits *behind* the body. */}
      {isCurrent && (
        <span
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[100px] rounded-full motion-safe:animate-[pulse-ring_1.8s_ease-out_infinite] pointer-events-none"
          style={{ boxShadow: `0 0 0 6px ${accentColor}59` }}
        />
      )}

      <button
        ref={ref}
        type="button"
        onClick={isLocked ? undefined : onClick}
        disabled={isLocked}
        aria-label={`${ariaLabel ?? `Dars ${positionLabel}`}, ${
          isLocked ? 'qulflangan' : isCompleted ? 'tugatilgan' : 'joriy'
        }`}
        aria-disabled={isLocked || undefined}
        className={buttonClasses}
        style={bodyStyle}
      >
        {innerIcon}
      </button>

      {/* Caption strip under current/perfect — Duolingo "BOSHLASH" speech bubble. */}
      {isCurrent && (
        <span
          className="px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          Boshlash
        </span>
      )}

    </div>
  );
});

export default LessonNode;
