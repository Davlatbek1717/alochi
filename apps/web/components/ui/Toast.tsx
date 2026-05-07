'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const ACCENT: Record<
  ToastType,
  { icon: ReactNode; bg: string; border: string; iconBg: string }
> = {
  success: {
    icon: <CheckCircle2 size={18} strokeWidth={2.25} />,
    bg: 'bg-[var(--surface)]',
    border: 'border-[var(--success)]/30',
    iconBg: 'bg-[var(--success-soft)] text-[var(--success)]',
  },
  error: {
    icon: <XCircle size={18} strokeWidth={2.25} />,
    bg: 'bg-[var(--surface)]',
    border: 'border-[var(--danger)]/30',
    iconBg: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  },
  warning: {
    icon: <AlertTriangle size={18} strokeWidth={2.25} />,
    bg: 'bg-[var(--surface)]',
    border: 'border-[var(--accent)]/30',
    iconBg: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
  },
  info: {
    icon: <Info size={18} strokeWidth={2.25} />,
    bg: 'bg-[var(--surface)]',
    border: 'border-[var(--brand)]/30',
    iconBg: 'bg-[var(--brand-soft)] text-[var(--brand)]',
  },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const a = ACCENT[toast.type];
  return (
    <div
      role="status"
      className={[
        'flex items-start gap-3',
        'pl-3 pr-4 py-3',
        a.bg,
        'border',
        a.border,
        'rounded-2xl',
        'shadow-[var(--shadow-4)]',
        'min-w-[300px] max-w-md',
        'motion-safe:[animation:slideIn_var(--dur-base)_var(--ease-out-expo)]',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 grid place-items-center w-9 h-9 rounded-xl',
          a.iconBg,
        ].join(' ')}
      >
        {a.icon}
      </span>
      <p className="flex-1 text-sm leading-relaxed text-[var(--ink)] pt-1">
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="shrink-0 grid place-items-center w-7 h-7 rounded-lg text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)] transition-colors"
        aria-label="Yopish"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    warning: (m) => show(m, 'warning'),
    info: (m) => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2.5">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onClose={() => remove(toast.id)}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
