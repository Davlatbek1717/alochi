'use client';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  /** Human-readable failure message (e.g. the caught error's message). */
  message?: string;
  /** Called when the user clicks "Qayta urinish" (Retry). */
  onRetry?: () => void;
  /** Whether a retry is currently in flight (shows a spinner, disables click). */
  retrying?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

/**
 * Standard failure state for data fetches. Replaces the silent
 * `.catch(() => emptyData)` pattern that left users staring at an empty
 * screen with no idea a request had failed and no way to retry (#11).
 */
export function ErrorState({
  message,
  onRetry,
  retrying = false,
  theme = 'light',
  className = '',
}: Props) {
  const isLight = theme === 'light';
  return (
    <div className={`text-center py-16 px-6 ${className}`}>
      <div
        className={[
          'mx-auto mb-5 w-20 h-20 rounded-3xl grid place-items-center',
          isLight
            ? 'bg-rose-50 border border-rose-200 text-rose-500'
            : 'bg-rose-950/40 border border-rose-900 text-rose-400',
        ].join(' ')}
      >
        <AlertTriangle size={30} />
      </div>
      <h3
        className={[
          'font-display text-lg font-bold mb-2 tracking-[-0.005em]',
          isLight ? 'text-[var(--ink)]' : 'text-slate-200',
        ].join(' ')}
      >
        Maʼlumotni yuklab boʻlmadi
      </h3>
      <p
        className={[
          'text-sm max-w-sm mx-auto leading-relaxed',
          isLight ? 'text-[var(--ink-3)]' : 'text-slate-400',
        ].join(' ')}
      >
        {message || 'Tarmoq xatosi yoki server javob bermadi.'}
      </p>
      {onRetry && (
        <div className="mt-6">
          <Button
            variant="tertiary"
            size="md"
            onClick={onRetry}
            loading={retrying}
            icon={<RotateCw size={16} />}
          >
            Qayta urinish
          </Button>
        </div>
      )}
    </div>
  );
}
