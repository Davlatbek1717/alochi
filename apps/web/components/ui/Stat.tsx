'use client';
import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; positive: boolean };
  color?: string;
  theme?: 'light' | 'dark';
}

export function Stat({ icon, label, value, sub, trend, color = 'text-emerald-400', theme = 'dark' }: Props) {
  const cardBg = theme === 'light'
    ? 'bg-white border-[#ede9e1] hover:border-[#d4cfc4]'
    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600';
  const labelText = theme === 'light' ? 'text-slate-700' : 'text-slate-400';
  const subText = 'text-slate-500';
  const valueText = theme === 'light' ? 'text-slate-900' : 'text-white';
  return (
    <div className={`${cardBg} border rounded-xl p-5 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        {icon && <span className={color}>{icon}</span>}
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.positive ? 'text-emerald-400 bg-emerald-900/30' : 'text-red-400 bg-red-900/30'}`}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold tabular-nums ${valueText}`}>{value}</p>
      <p className={`text-xs mt-1 ${labelText}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${subText}`}>{sub}</p>}
    </div>
  );
}
