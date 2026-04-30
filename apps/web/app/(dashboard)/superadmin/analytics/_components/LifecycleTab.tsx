'use client';
import { useEffect, useState } from 'react';
import { Activity, Users, UserCheck, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Lifecycle {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

export function LifecycleTab() {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lifecycle>('/analytics/lifecycle', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;
  if (!data) return null;

  const cards = [
    { label: 'DAU', value: data.dau, sub: 'Daily Active Users', Icon: Activity, color: 'text-emerald-400' },
    { label: 'WAU', value: data.wau, sub: 'Weekly Active Users', Icon: Users, color: 'text-blue-400' },
    { label: 'MAU', value: data.mau, sub: 'Monthly Active Users', Icon: UserCheck, color: 'text-purple-400' },
    { label: 'Stickiness', value: `${(data.stickiness * 100).toFixed(0)}%`, sub: 'DAU/MAU ratio', Icon: Zap, color: 'text-amber-400' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Lifecycle Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <c.Icon size={20} className={c.color} />
            <p className="text-3xl font-bold text-white mt-3">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
