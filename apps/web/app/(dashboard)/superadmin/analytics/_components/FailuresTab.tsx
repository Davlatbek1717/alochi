'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Failure {
  lessonId: string;
  failedCount: number;
  completedCount: number;
  failureRate: number;
}

export function FailuresTab() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Failure[]>('/analytics/failures?limit=20', {}, token)
      .then((r) => setFailures(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Top Failure Lessons</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Dars ID</th>
              <th className="text-center px-3 py-2 text-slate-400">Failed</th>
              <th className="text-center px-3 py-2 text-slate-400">Completed</th>
              <th className="text-center px-3 py-2 text-slate-400">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {failures.map((f) => (
              <tr key={f.lessonId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{f.lessonId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center text-red-400 font-semibold">{f.failedCount}</td>
                <td className="px-3 py-2 text-center text-green-400">{f.completedCount}</td>
                <td className="px-3 py-2 text-center">
                  <span className={f.failureRate >= 50 ? 'text-red-400' : f.failureRate >= 30 ? 'text-yellow-400' : 'text-slate-300'}>
                    {f.failureRate}%
                  </span>
                </td>
              </tr>
            ))}
            {failures.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Failures yo&apos;q — ajoyib!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
