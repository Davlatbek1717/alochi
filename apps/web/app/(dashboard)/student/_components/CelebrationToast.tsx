'use client';
import { useEffect } from 'react';
import { Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import Confetti from '../lessons/[id]/_components/Confetti';

/**
 * 25.H.2 / Pass 6: Brief celebration toast played after AI evaluate score
 * >= 80. Auto-dismisses after `durationMs` and plays the shared
 * `complete.mp3` cue via the sound helper. Renders Aloqush (happy) on the
 * left, an "AJOYIB!" headline, and pure-CSS confetti behind the card.
 */
export function CelebrationToast({
  show,
  message = 'Sizning javobingiz aʼlo darajada.',
  durationMs = 3000,
  onClose,
}: {
  show: boolean;
  message?: string;
  durationMs?: number;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    playSound('complete');
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs, onClose]);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center pointer-events-none px-4">
      <div className="relative pointer-events-auto">
        {/* Confetti behind the card */}
        <div className="absolute -inset-12 -z-10">
          <Confetti count={24} />
        </div>
        <div
          className="bg-white border-[1.5px] border-[#ede9e1] rounded-[20px] shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[280px] motion-safe:[animation:bounce-in_500ms_ease-out]"
          role="status"
          aria-live="polite"
        >
          <Mascot expression="happy" size={56} />
          <div>
            <p className="text-[#58cc02] font-extrabold text-lg leading-tight uppercase tracking-wide">
              Ajoyib!
            </p>
            <p className="text-[#0f172a] text-sm leading-snug">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CelebrationToast;
