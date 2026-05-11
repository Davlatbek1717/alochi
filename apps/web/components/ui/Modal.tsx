'use client';
import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnOverlay?: boolean;
  theme?: 'light' | 'dark';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const THEME = {
  light: {
    surface:
      'bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow-5)]',
    title: 'text-[var(--ink)]',
    description: 'text-[var(--ink-3)]',
    closeBtn:
      'text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)]',
    border: 'border-[var(--line)]',
    footer: 'bg-[var(--surface-2)]',
  },
  dark: {
    surface: 'bg-slate-800 border border-slate-700 shadow-2xl',
    title: 'text-white',
    description: 'text-slate-400',
    closeBtn: 'text-slate-500 hover:text-slate-300',
    border: 'border-slate-700',
    footer: 'bg-slate-800/50',
  },
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  theme = 'light',
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const t = THEME[theme];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-[#0f0c2d]/70 backdrop-blur-sm',
        'motion-safe:[animation:fadeIn_var(--dur-base)_var(--ease-out-expo)]',
      ].join(' ')}
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={[
          t.surface,
          'rounded-3xl w-full flex flex-col max-h-[calc(100dvh-2rem)]',
          SIZES[size],
          'motion-safe:[animation:scaleIn_var(--dur-slow)_var(--ease-spring)]',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div
            className={`shrink-0 flex items-start justify-between p-6 border-b ${t.border}`}
          >
            <div className="min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className={`font-display text-xl font-bold tracking-[-0.005em] ${t.title}`}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className={`text-sm leading-relaxed mt-1 ${t.description}`}>
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Yopish"
              className={[
                'grid place-items-center w-10 h-10 rounded-xl shrink-0 ml-3',
                'transition-colors',
                t.closeBtn,
              ].join(' ')}
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6">{children}</div>
        {footer && (
          <div
            className={[
              'shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 px-6 py-4 border-t rounded-b-3xl',
              t.border,
              t.footer,
            ].join(' ')}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
