'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiRequest } from '@/lib/api';

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
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((r) => {
        setLessons(r.data);
        if (r.data.length > 0) setSelectedLessonId(r.data[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLessonId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FunnelStep[]>(`/analytics/funnel/${selectedLessonId}`, {}, token)
      .then((r) => setFunnel(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'));
  }, [selectedLessonId]);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Funnel Analysis</h2>
      <div className="mb-4">
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
      {funnel.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis dataKey="step" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
