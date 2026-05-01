'use client';
import { useEffect, type FC } from 'react';
import { Clock, Sparkles, BookOpen, X } from 'lucide-react';
import { Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';

export interface SheetLesson {
  id: string;
  title: string;
  orderNumber: number;
  unitName: string;
  estimatedMinutes?: number;
  xpReward?: number;
  type?: string;
}

interface Props {
  open: boolean;
  lesson: SheetLesson | null;
  /** State of the lesson — affects CTA label and mascot mood. */
  state: 'current' | 'completed';
  onClose: () => void;
  onStart: (lessonId: string) => void;
}

/**
 * LessonBottomSheet — slide-up modal that previews a lesson before the user
 * commits to starting it.
 *
 * Layout (mobile-first):
 *   - Backdrop dim with click-to-close
 *   - Sheet anchored to bottom, slides up from below the viewport
 *   - Header: title + unit subtitle
 *   - Stat row: Clock (minutes), Sparkles (XP), BookOpen (type)
 *   - Aloqush mascot small + "BOSHLASH" duo button + ghost "Yopish"
 *
 * The sheet uses raw `<div>`s rather than the shared `Modal` so we can
 * anchor to the bottom edge and slide up — the shared Modal centres
 * everything and isn't appropriate for this Duolingo-style sheet.
 */
export const LessonBottomSheet: FC<Props> = ({
  open,
  lesson,
  state,
  onClose,
  onStart,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !lesson) return null;

  const minutes = lesson.estimatedMinutes ?? 5;
  const xp = lesson.xpReward ?? 10;
  const typeLabel = lesson.type ?? 'Dars';
  const isCompleted = state === 'completed';

  const handleStart = () => {
    playSound('xp', 0.5);
    onStart(lesson.id);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm motion-safe:animate-[fadeIn_0.18s_ease-out]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#fffaf0] rounded-t-3xl border-t-2 border-[#ede9e1] shadow-2xl motion-safe:animate-[slideUp_0.25s_ease-out] pb-[max(env(safe-area-inset-bottom),16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-[#e8e0d0]" />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-5 w-9 h-9 rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#777] hover:text-[#3c3c3c] transition-colors"
          aria-label="Yopish"
        >
          <X size={18} />
        </button>

        <div className="px-5 pt-3 pb-5 flex items-start gap-3">
          <div className="shrink-0">
            <Mascot
              expression={isCompleted ? 'happy' : 'idle'}
              size={72}
              animated
            />
          </div>
          <div className="flex-1 min-w-0 pt-1 pr-10">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#46a302]">
              {lesson.unitName}
            </p>
            <h2
              id="lesson-sheet-title"
              className="text-lg font-extrabold text-[#3c3c3c] leading-tight mt-0.5 line-clamp-2"
            >
              #{lesson.orderNumber} — {lesson.title}
            </h2>
          </div>
        </div>

        <div className="px-5 grid grid-cols-3 gap-2">
          <StatTile
            icon={<Clock size={16} className="text-[#58a6ff]" />}
            value={`${minutes} daq.`}
            label="Davomiyligi"
          />
          <StatTile
            icon={<Sparkles size={16} className="text-[#fbbf24]" />}
            value={`+${xp} XP`}
            label="Mukofot"
          />
          <StatTile
            icon={<BookOpen size={16} className="text-[#ce82ff]" />}
            value={typeLabel}
            label="Turi"
          />
        </div>

        <div className="px-5 pt-5 space-y-2">
          <button
            type="button"
            onClick={handleStart}
            className="w-full bg-[#58cc02] hover:brightness-105 text-white py-3.5 rounded-2xl font-extrabold uppercase tracking-wide border-b-[4px] border-[#46a302] active:translate-y-[2px] active:border-b-[2px] transition-all text-base"
          >
            {isCompleted ? "Qayta o'qish" : 'Boshlash'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-[#777] hover:text-[#3c3c3c] py-2 rounded-2xl font-bold uppercase tracking-wide text-xs transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>

      {/* Local keyframe — slideUp is unique to this sheet so we inline it here
          rather than polluting globals.css. */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const StatTile: FC<{ icon: React.ReactNode; value: string; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div className="bg-white rounded-2xl border border-[#ede9e1] p-2.5 text-center">
    <div className="flex justify-center mb-1">{icon}</div>
    <p className="text-sm font-extrabold text-[#3c3c3c] leading-tight truncate">
      {value}
    </p>
    <p className="text-[9px] font-bold uppercase tracking-wider text-[#777] mt-0.5">
      {label}
    </p>
  </div>
);

export default LessonBottomSheet;
