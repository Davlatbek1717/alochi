'use client';
import { type FC } from 'react';

interface ProgressBarProps {
  /** Total exercises in the lesson (denominator). Falls back to 1 to avoid div-by-zero. */
  total: number;
  /** Exercises already completed (numerator). Clamped to [0, total]. */
  completed: number;
  /** Optional className for outer wrapper (e.g. flex sizing from parent). */
  className?: string;
}

/**
 * ProgressBar — single unified Duolingo-green progress bar that replaces the
 * old multi-pill step strip. One bar, one colour, smooth fill animation.
 *
 * Visual:
 *  - 8px tall, fully rounded
 *  - track: --alc-line (#e8e0d0, cream)
 *  - fill: solid #58cc02 with a soft inner highlight stripe for the
 *    "glossy" Duolingo feel. width transitions over 400ms.
 */
export const ProgressBar: FC<ProgressBarProps> = ({
  total,
  completed,
  className = '',
}) => {
  const denom = Math.max(1, total);
  const pct = Math.max(0, Math.min(100, (completed / denom) * 100));

  return (
    <div
      className={`relative h-2 rounded-full bg-[#e8e0d0] overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.min(completed, denom)}
      aria-valuemin={0}
      aria-valuemax={denom}
      aria-valuetext={`${Math.min(completed, denom)} / ${denom}`}
      aria-label="Dars jarayoni"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-[#58cc02] transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      >
        {/* Soft top highlight stripe — gives the bar that polished Duo gloss. */}
        <span
          aria-hidden
          className="absolute top-[2px] left-[6px] right-[6px] h-[2px] rounded-full bg-white/40"
        />
      </div>
    </div>
  );
};

export default ProgressBar;
