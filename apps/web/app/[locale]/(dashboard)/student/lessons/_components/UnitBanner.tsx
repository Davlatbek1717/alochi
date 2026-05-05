'use client';
import type { FC } from 'react';
import { Mascot } from '@/components/ui';

export interface UnitTheme {
  /** Body fill of the banner (one of the 5 cycling unit colours). */
  bg: string;
  /** Slightly darker tone — used for the bottom 3D shadow strip. */
  shadow: string;
  /** Title for the unit (e.g. "Salomlashish"). */
  title: string;
}

interface Props {
  /** 1-indexed unit number — shown as "1-bo'lim". */
  unitNumber: number;
  theme: UnitTheme;
  /** When all 5 lessons are completed, banner gets a subtle gold sash. */
  completed?: boolean;
}

/**
 * UnitBanner — coloured "section header" for a 5-lesson unit on the snake path.
 *
 * Visual: thick rounded band, white serif-y bold title on top, "X-bo'lim · NAME"
 * subtitle, and the Aloqush mascot peeking from the right edge. Bottom edge has
 * a darker tone strip for the 3D feel that ties together with the LessonNode
 * 3D press depth.
 *
 * Theming is driven entirely by the `theme` prop so the parent can rotate
 * through the 5-colour cycle (green/blue/purple/red/orange).
 */
export const UnitBanner: FC<Props> = ({ unitNumber, theme, completed }) => {
  return (
    <div
      className="relative w-full rounded-2xl px-5 pt-4 pb-5 text-white overflow-hidden"
      style={{
        backgroundColor: theme.bg,
        boxShadow: `inset 0 -6px 0 ${theme.shadow}`,
      }}
    >
      <div className="relative z-10 max-w-[70%]">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-90">
          {unitNumber}-bo&apos;lim
        </p>
        <h2 className="text-xl font-extrabold leading-tight mt-1">
          {theme.title}
        </h2>
        {completed && (
          <span className="inline-flex items-center gap-1 mt-2 bg-white/25 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
            <span aria-hidden>★</span> Tugatildi
          </span>
        )}
      </div>

      {/* Mascot peeks from the right side. Reduced motion is respected by Mascot itself. */}
      <div className="absolute right-2 -bottom-1 opacity-90 pointer-events-none">
        <Mascot
          expression={completed ? 'happy' : 'idle'}
          size={88}
          animated
        />
      </div>
    </div>
  );
};

export default UnitBanner;
