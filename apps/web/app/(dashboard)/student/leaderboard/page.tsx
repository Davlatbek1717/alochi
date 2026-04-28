'use client';
import { useState, useEffect } from 'react';
import { Trophy, Building2, Globe, Flame, Medal } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type BranchEntry = { rank: number; id: string; name: string; totalXp: number; streak: number };
type NationalEntry = { rank: number; alias: string; xp: number };

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-[#f59e0b] flex items-center justify-center">
      <Medal size={16} className="text-white" />
    </div>
  );
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-[#94a3b8] flex items-center justify-center">
      <Medal size={16} className="text-white" />
    </div>
  );
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-[#cd7f32] flex items-center justify-center">
      <Medal size={16} className="text-white" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center">
      <span className="text-xs font-bold text-[#64748b]">{rank}</span>
    </div>
  );
}

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

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
              <Trophy size={18} className="text-[#f59e0b]" />
            </div>
            <p className="text-white font-bold text-lg">Reyting</p>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setTab('branch')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === 'branch' ? 'bg-white text-[#0f172a]' : 'bg-white/5 border border-white/10 text-[#94a3b8]'
              }`}
            >
              <Building2 size={14} /> Filial
            </button>
            <button
              onClick={() => setTab('national')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === 'national' ? 'bg-white text-[#0f172a]' : 'bg-white/5 border border-white/10 text-[#94a3b8]'
              }`}
            >
              <Globe size={14} /> Milliy
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4">
        {tab === 'national' && (
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  period === p ? 'bg-[#0f172a] text-white' : 'bg-white border border-[#ede9e1] text-[#64748b]'
                }`}
              >
                {p === 'weekly' ? 'Haftalik' : 'Oylik'}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#f7f4ef]" />
                  <div className="h-4 bg-[#f7f4ef] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'branch' ? (
          <div className="space-y-2">
            {branch.map((e) => (
              <div
                key={e.id}
                className={`bg-white rounded-[18px] border-[1.5px] p-4 flex items-center gap-3 ${
                  e.id === myId ? 'border-[#0d9488] bg-[#0d9488]/5' : 'border-[#ede9e1]'
                }`}
              >
                <RankBadge rank={e.rank} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">
                    {e.name} {e.id === myId && <span className="text-xs text-[#0d9488] font-normal">(Siz)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Flame size={12} className="text-orange-400" />
                    <span className="text-xs text-[#64748b]">{e.streak} kun streak</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#f59e0b] font-black text-lg font-mono">{e.totalXp}</p>
                  <p className="text-[#94a3b8] text-xs">XP</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {national.map((e) => (
              <div key={e.rank} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3">
                <RankBadge rank={e.rank} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">{e.alias}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#f59e0b] font-black text-lg font-mono">{e.xp}</p>
                  <p className="text-[#94a3b8] text-xs">XP</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
