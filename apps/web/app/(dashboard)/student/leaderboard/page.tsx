'use client';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

type BranchEntry = { rank: number; id: string; name: string; totalXp: number; streak: number };
type NationalEntry = { rank: number; alias: string; xp: number };

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'branch' | 'national'>('branch');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [branch, setBranch] = useState<BranchEntry[]>([]);
  const [national, setNational] = useState<NationalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setMyId(payload.sub ?? '');
    } catch {}

    Promise.all([
      apiRequest<BranchEntry[]>('/gamification/leaderboard/branch', {}, token),
      apiRequest<NationalEntry[]>(`/gamification/leaderboard/national?period=${period}`, {}, token),
    ]).then(([b, n]) => {
      setBranch(b.data ?? []);
      setNational(n.data ?? []);
    }).finally(() => setLoading(false));
  }, [period]);

  const rankIcon = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `${r}.`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">🏆 Reyting</h1>

      <div className="flex gap-2">
        {(['branch', 'national'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t === 'branch' ? '🏢 Filial' : '🌍 Milliy'}
          </button>
        ))}
      </div>

      {tab === 'national' && (
        <div className="flex gap-2">
          {(['weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                period === p ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {p === 'weekly' ? 'Haftalik' : 'Oylik'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : tab === 'branch' ? (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {branch.map((e) => (
            <div
              key={e.id}
              className={`flex items-center gap-3 p-4 border-b border-gray-50 last:border-0 ${
                e.id === myId ? 'bg-indigo-50' : ''
              }`}
            >
              <span className="w-8 text-center font-bold text-gray-700">{rankIcon(e.rank)}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {e.name} {e.id === myId && <span className="text-xs text-indigo-600">(Siz)</span>}
                </p>
                <p className="text-xs text-gray-500">🔥 {e.streak} kun · {e.totalXp} XP</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {national.map((e) => (
            <div key={e.rank} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0">
              <span className="w-8 text-center font-bold text-gray-700">{rankIcon(e.rank)}</span>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{e.alias}</p>
                <p className="text-xs text-gray-500">{e.xp} XP</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
