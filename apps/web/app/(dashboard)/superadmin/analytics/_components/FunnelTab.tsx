'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';

interface Lesson {
  id: string;
  title: string;
}

interface FunnelStep {
  step: string;
  count: number;
}

export function FunnelTab() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((r) => {
        setLessons(r.data);
        if (r.data.length > 0) setSelectedLessonId(r.data[0].id);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedLessonId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FunnelStep[]>(`/analytics/funnel/${selectedLessonId}`, {}, token)
      .then((r) => setFunnel(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'));
  }, [selectedLessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Funnel Analysis</h2>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Dars tanlang</label>
        <select
          value={selectedLessonId}
          onChange={(e) => setSelectedLessonId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </div>

      {funnel.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis dataKey="step" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState
          icon={<TrendingDown size={24} />}
          title="Funnel ma'lumotlari yo'q"
          description="Tanlangan dars uchun funnel tahlili mavjud emas"
        />
      )}
    </div>
  );
}
