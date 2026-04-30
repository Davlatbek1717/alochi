'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  theme?: 'light' | 'dark';
  className?: string;
}

export function EmptyState({ icon, title, description, action, theme = 'dark', className = '' }: Props) {
  const styles = theme === 'light'
    ? {
        iconBg: 'bg-[#f7f4ef] border-[#ede9e1] text-slate-500',
        title: 'text-slate-900',
        desc: 'text-slate-600',
      }
    : {
        iconBg: 'bg-slate-800/80 border-slate-700 text-slate-500',
        title: 'text-slate-200',
        desc: 'text-slate-400',
      };
  return (
    <div className={`text-center py-12 px-6 ${className}`}>
      {icon && (
        <div className={`mx-auto mb-4 w-16 h-16 rounded-2xl border flex items-center justify-center ${styles.iconBg}`}>
          {icon}
        </div>
      )}
      <h3 className={`text-base font-semibold mb-1.5 ${styles.title}`}>{title}</h3>
      {description && <p className={`text-sm max-w-sm mx-auto mb-4 ${styles.desc}`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
