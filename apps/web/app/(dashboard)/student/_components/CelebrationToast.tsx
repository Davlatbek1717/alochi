'use client';
import { useEffect, useRef } from 'react';

/**
 * 25.H.2: Brief celebration toast played after AI evaluate score >= 80.
 * Auto-dismisses after `durationMs` and (best-effort) plays a quiet
 * audio cue. The audio asset is optional; if absent, the toast still
 * shows.
 */
export function CelebrationToast({
  show,
  message = "Ajoyib! Sizning javobingiz aʼlo darajada.",
  durationMs = 2500,
  onClose,
}: {
  show: boolean;
  message?: string;
  durationMs?: number;
  onClose?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!show) return;
    audioRef.current?.play().catch(() => undefined);
    const t = setTimeout(() => onClose?.(), durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs, onClose]);

  if (!show) return null;
  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center pointer-events-none">
      <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-[#0f172a] px-5 py-3 rounded-[18px] shadow-xl font-bold text-sm flex items-center gap-2">
        <span aria-hidden>🎉</span>
        {message}
      </div>
      <audio ref={audioRef} src="/sounds/celebrate.mp3" preload="auto" />
    </div>
  );
}
