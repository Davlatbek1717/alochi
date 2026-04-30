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
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnOverlay = true }: Props) {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={closeOnOverlay ? onClose : undefined}
    >
      <div
        className={`bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full ${SIZES[size]} animate-[scaleIn_0.15s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-6 border-b border-slate-700">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-white">
                  {title}
                </h2>
              )}
              {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Yopish" className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}
