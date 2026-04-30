'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface LessonStat {
  lessonId: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

export function LessonsTab() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LessonStat[]>('/analytics/lessons', {}, token)
      .then((r) => setLessons(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Darslar Samaradorligi</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Dars ID</th>
              <th className="text-center px-3 py-2 text-slate-400">Pass rate</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;quvchilar</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. sessiya</th>
              <th className="text-center px-3 py-2 text-slate-400">Fikr</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.lessonId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{l.lessonId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center">
                  <span className={l.passRate >= 70 ? 'text-green-400' : l.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {l.passRate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-slate-300">{l.totalStudents}</td>
                <td className="px-3 py-2 text-center text-slate-300">{l.avgSessions}</td>
                <td className="px-3 py-2 text-center text-slate-300">{l.feedbackAvg ?? '—'}</td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
