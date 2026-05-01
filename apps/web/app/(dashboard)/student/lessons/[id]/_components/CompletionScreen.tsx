'use client';
import { useEffect, type FC } from 'react';
import { Sparkles, Flame, Target } from 'lucide-react';
import { Mascot, Button } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { Confetti } from './Confetti';

interface CompletionScreenProps {
  /** XP awarded for this session. Falls back to 30. */
  xpEarned?: number;
  /** Current streak (post-session). */
  streak?: number;
  /** Accuracy 0..100. Derived from hearts remaining or wrongs by parent. */
  accuracy?: number;
  /** True when the user gained a level on this session. */
  leveledUp?: boolean;
  /** Optional notice — e.g. "Bu darsda imtihon bor" (academy lock). */
  notice?: string;
  /** Fired when user taps the primary CTA. */
  onPrimary: () => void;
  /** Label for the primary CTA. Default "Keyingi dars". */
  primaryLabel?: string;
  /** Fired when user taps the ghost link "Bosh sahifa". */
  onSecondary: () => void;
  /** Optional inline error banner (e.g. session save failed). */
  errorBanner?: string;
  /** Optional retry action when errorBanner is shown. */
  onRetry?: () => void;
}

/**
 * CompletionScreen — the celebratory full-screen Aloqush-and-confetti reward
 * that replaces the old generic check-icon "Sessiya yakunlandi" card.
 *
 * On mount we play `complete.mp3`. If `leveledUp` is true we also play
 * `levelup.mp3` 350ms later so the two sounds don't overlap muddily. Both
 * calls are safe no-ops if the user has muted via the global sound toggle.
 *
 * The confetti rains from above the viewport via the `confetti-fall`
 * keyframe; everything else is static. Mascot wiggles via its own happy
 * animation.
 */
export const CompletionScreen: FC<CompletionScreenProps> = ({
  xpEarned,
  streak,
  accuracy,
  leveledUp,
  notice,
  onPrimary,
  primaryLabel = 'Keyingi dars',
  onSecondary,
  errorBanner,
  onRetry,
}) => {
  useEffect(() => {
    playSound('complete', 0.55);
    if (leveledUp) {
      const t = window.setTimeout(() => playSound('levelup', 0.6), 350);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [leveledUp]);

  const xp = xpEarned ?? 30;
  const showStreak = typeof streak === 'number' && streak > 0;
  const showAccuracy =
    typeof accuracy === 'number' && Number.isFinite(accuracy);

  return (
    <div className="relative min-h-screen bg-[#fffaf0] overflow-hidden">
      <Confetti count={32} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="motion-safe:[animation:bounce-in_600ms_ease-out]">
          <Mascot expression="happy" size={180} animated />
        </div>

        <h1
          className="mt-6 text-3xl sm:text-4xl font-extrabold leading-tight text-[#3c3c3c]"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {leveledUp ? 'YANGI DARAJA!' : 'AJOYIB!'}
        </h1>
        <p className="mt-1 text-sm sm:text-base font-semibold text-[#7a5e2c] max-w-sm">
          {leveledUp
            ? "Keyingi darajaga ko‘tarildingiz! Davom etamiz."
            : 'Sessiyani muvaffaqiyatli yakunladingiz'}
        </p>

        {/* Stat tiles row */}
        <div className="mt-8 grid grid-cols-3 gap-2 w-full max-w-sm">
          <StatTile
            icon={<Sparkles size={16} className="text-[#ce82ff]" />}
            value={`+${xp}`}
            label="XP"
          />
          <StatTile
            icon={<Flame size={16} className="text-[#ff9500]" />}
            value={showStreak ? String(streak) : '—'}
            label="Zanjir"
            muted={!showStreak}
          />
          <StatTile
            icon={<Target size={16} className="text-[#58cc02]" />}
            value={showAccuracy ? `${Math.round(accuracy as number)}%` : '—'}
            label="Aniqlik"
            muted={!showAccuracy}
          />
        </div>

        {notice ? (
          <div className="mt-6 max-w-sm w-full bg-amber-50 border-[1.5px] border-amber-200 rounded-2xl px-4 py-3 text-left">
            <p className="text-xs text-amber-700 font-semibold leading-relaxed">
              {notice}
            </p>
          </div>
        ) : null}

        {errorBanner ? (
          <div className="mt-6 max-w-sm w-full bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl px-4 py-3 text-left flex items-start gap-3">
            <p className="flex-1 text-xs text-rose-700 font-semibold leading-relaxed">
              {errorBanner}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-extrabold text-rose-700 underline shrink-0"
              >
                Qayta urinish
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 w-full max-w-sm space-y-3">
          <Button
            variant="duo"
            size="lg"
            fullWidth
            onClick={onPrimary}
            className="!py-4 !text-base"
          >
            {primaryLabel}
          </Button>
          <button
            type="button"
            onClick={onSecondary}
            className="w-full py-3 text-sm font-extrabold text-[#7a5e2c] hover:text-[#3c3c3c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Bosh sahifa
          </button>
        </div>
      </div>
    </div>
  );
};

interface StatTileProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  muted?: boolean;
}

const StatTile: FC<StatTileProps> = ({ icon, value, label, muted }) => (
  <div
    className={`flex flex-col items-center justify-center gap-1 bg-white border-[1.5px] rounded-2xl py-3 px-2 ${
      muted ? 'border-[#ede9e1] opacity-70' : 'border-[#e8e0d0]'
    }`}
  >
    <div className="flex items-center gap-1">
      {icon}
      <span
        className="text-base font-extrabold text-[#3c3c3c]"
        style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
      >
        {value}
      </span>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-[#777]">
      {label}
    </span>
  </div>
);

export default CompletionScreen;
