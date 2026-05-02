'use client';
import { X, Clock } from 'lucide-react';
import { type FC } from 'react';
import { Mascot, Button } from '@/components/ui';

interface LessonIntroProps {
  title: string;
  /** 1-indexed lesson number. When missing we hide the "N-DARS" eyebrow. */
  orderNumber?: number;
  /** Optional one-line subtitle (description / theme). */
  subtitle?: string;
  /** Estimated minutes. Falls back to 5. */
  estimatedMinutes?: number;
  /** XP awarded on completion. Falls back to 30. */
  xpReward?: number;
  /** Fired when user taps "BOSHLASH" — parent advances to first real step. */
  onStart: () => void;
  /** Fired when user taps the close ✕. */
  onClose: () => void;
}

/**
 * LessonIntro — full-screen welcome shown BEFORE any exercise loads.
 *
 * Sets emotional expectation and gives the user a single, obvious call to
 * action ("BOSHLASH"). The Boshlash tap is also the user-gesture that
 * unlocks `xp.mp3` / `correct.mp3` autoplay on iOS Safari, so we
 * intentionally play no sound here.
 *
 * Layout (mobile-first, max-w-md):
 *   ✕                                  ← top-left
 *   [Aloqush waving, 160px]
 *   "1-DARS"  (eyebrow, muted)
 *   "Salomlashish" (display, extrabold)
 *   "Tabriklashning oddiy yo'llari" (subtitle, smaller)
 *   ┌ ⏱ 5 daqiqa ┬ ✨ +30 XP ┐  (stat tiles)
 *   [    BOSHLASH    ]            (duo button)
 */
export const LessonIntro: FC<LessonIntroProps> = ({
  title,
  orderNumber,
  subtitle,
  estimatedMinutes,
  onStart,
  onClose,
}) => {
  const minutes = estimatedMinutes ?? 5;

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col">
      {/* Top bar — just a close button, max breathing room. */}
      <div className="flex items-center px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#777] hover:text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors"
        >
          <X size={24} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
        {/* Mascot — happy + animated, bounces in via Mascot's own bounce-in anim. */}
        <div className="motion-safe:[animation:bounce-in_500ms_ease-out]">
          <Mascot expression="happy" size={160} animated />
        </div>

        {orderNumber ? (
          <p
            className="mt-6 text-xs font-extrabold tracking-[0.2em] text-[#7a5e2c] uppercase"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {orderNumber}-DARS
          </p>
        ) : null}

        <h1
          className="mt-2 text-3xl sm:text-4xl font-extrabold leading-tight text-[#3c3c3c]"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-2 text-sm sm:text-base font-semibold text-[#777] max-w-sm">
            {subtitle}
          </p>
        ) : null}

        {/* Stat tile */}
        <div className="mt-8 w-full max-w-sm">
          <StatTile
            icon={<Clock size={18} className="text-[#1cb0f6]" />}
            label={`${minutes} daqiqa`}
          />
        </div>

        {/* Big Boshlash CTA */}
        <div className="mt-10 w-full max-w-sm">
          <Button
            variant="duo"
            size="lg"
            fullWidth
            onClick={onStart}
            className="!py-4 !text-base"
          >
            Boshlash
          </Button>
        </div>
      </div>
    </div>
  );
};

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
}

const StatTile: FC<StatTileProps> = ({ icon, label }) => (
  <div className="flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#e8e0d0] rounded-2xl py-3 px-4">
    {icon}
    <span
      className="text-sm font-extrabold text-[#3c3c3c]"
      style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
    >
      {label}
    </span>
  </div>
);

export default LessonIntro;
