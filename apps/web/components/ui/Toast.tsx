'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
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

const ICON: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error: <XCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

const BORDER: Record<ToastType, string> = {
  success: 'border-emerald-700/50',
  error: 'border-red-700/50',
  warning: 'border-amber-700/50',
  info: 'border-blue-700/50',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 py-3 bg-slate-800 border ${BORDER[toast.type]} rounded-lg shadow-2xl min-w-[280px] max-w-md animate-[slideIn_0.2s_ease-out]`}
    >
      <span className="shrink-0 mt-0.5">{ICON[toast.type]}</span>
      <p className="flex-1 text-sm text-slate-200">{toast.message}</p>
      <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-slate-300" aria-label="Yopish">
        <X size={14} />
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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={() => remove(toast.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
