'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface BranchStat {
  branchId: string;
  activeStudents: number;
  avgStreak: number;
  avgXp: number;
}

export function BranchesTab() {
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<BranchStat[]>('/analytics/branches', {}, token)
      .then((r) => setBranches(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Filiallar Taqqoslash</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Filial</th>
              <th className="text-center px-3 py-2 text-slate-400">Faol o&apos;quvchilar</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. streak</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. XP</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branchId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{b.branchId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center text-white font-semibold">{b.activeStudents}</td>
                <td className="px-3 py-2 text-center text-blue-400">{b.avgStreak}</td>
                <td className="px-3 py-2 text-center text-purple-400">{b.avgXp}</td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
