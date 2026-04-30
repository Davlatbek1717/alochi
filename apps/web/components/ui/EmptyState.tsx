'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: Props) {
  return (
    <div className={`text-center py-12 px-6 ${className}`}>
      {icon && (
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-200 mb-1.5">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mx-auto mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
