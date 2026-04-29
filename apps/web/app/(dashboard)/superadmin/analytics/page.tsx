'use client';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface LessonStat {
  lessonId: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

interface BranchStat {
  branchId: string;
  activeStudents: number;
  avgStreak: number;
  avgXp: number;
}

interface ActivityPoint {
  day: string;
  count: number;
}

export default function AnalyticsPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    Promise.all([
      apiRequest<LessonStat[]>('/analytics/lessons', {}, token()),
      apiRequest<BranchStat[]>('/analytics/branches', {}, token()),
      apiRequest<ActivityPoint[]>('/analytics/activity?period=monthly', {}, token()),
    ])
      .then(([l, b, a]) => { setLessons(l.data); setBranches(b.data); setActivity(a.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-green-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
      </div>
      {error && <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">So&apos;nggi 30 kun — Faol o&apos;quvchilar</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={activity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Darslar Samaradorligi</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Dars ID</th>
              <th className="text-center px-4 py-3 text-slate-400">Pass rate</th>
              <th className="text-center px-4 py-3 text-slate-400">O&apos;quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400">O&apos;rtacha sessiya</th>
              <th className="text-center px-4 py-3 text-slate-400">Fikr</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.lessonId} className="border-b border-slate-700/50">
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{l.lessonId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-center">
                  <span className={l.passRate >= 70 ? 'text-green-400' : l.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>{l.passRate}%</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-300">{l.totalStudents}</td>
                <td className="px-4 py-3 text-center text-slate-300">{l.avgSessions}</td>
                <td className="px-4 py-3 text-center text-slate-300">{l.feedbackAvg ?? '—'}</td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q (MV bo&apos;sh)</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Filiallar Taqqoslash</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Filial</th>
              <th className="text-center px-4 py-3 text-slate-400">Faol o&apos;quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400">O&apos;rt. streak</th>
              <th className="text-center px-4 py-3 text-slate-400">O&apos;rt. XP</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branchId} className="border-b border-slate-700/50">
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{b.branchId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-center text-white font-semibold">{b.activeStudents}</td>
                <td className="px-4 py-3 text-center text-blue-400">{b.avgStreak}</td>
                <td className="px-4 py-3 text-center text-purple-400">{b.avgXp}</td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
