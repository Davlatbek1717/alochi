'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Building2,
  Globe,
  Flame,
  ArrowUp,
  ArrowDown,
  TimerReset,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot } from '@/components/ui';
import { Podium, type PodiumEntry } from '../_components/Podium';

type BranchEntry = {
  rank: number;
  id: string;
  name: string;
  totalXp: number;
  streak: number;
};
type NationalEntry = { rank: number; alias: string; xp: number };

const PROMOTE_TOP = 7;
const DEMOTE_BOTTOM = 7;

function weeklyResetIn(): { days: number; hours: number } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  // Reset Sunday 23:59:59
  const target = new Date(now);
  const daysUntilSunday = (7 - dow) % 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(23, 59, 59, 0);
  if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 7);
  const diffMs = target.getTime() - now.getTime();
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  return { days, hours };
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
      const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string };
      setMyId(payload.sub ?? '');
    } catch {}

    Promise.all([
      apiRequest<BranchEntry[]>('/gamification/leaderboard/branch', {}, token),
      apiRequest<NationalEntry[]>(
        `/gamification/leaderboard/national?period=${period}`,
        {},
        token,
      ),
    ])
      .then(([b, n]) => {
        setBranch(b.data ?? []);
        setNational(n.data ?? []);
      })
      .finally(() => setLoading(false));
  }, [period]);

  const reset = weeklyResetIn();

  const branchPodium: PodiumEntry[] = useMemo(
    () =>
      branch
        .filter((e) => e.rank <= 3)
        .map((e) => ({
          id: e.id,
          name: e.name,
          xp: e.totalXp,
          rank: e.rank,
        })),
    [branch],
  );
  const branchRest = useMemo(() => branch.filter((e) => e.rank > 3), [branch]);
  const myRow = useMemo(() => branch.find((e) => e.id === myId), [branch, myId]);
  const myRowVisible = useMemo(() => {
    if (!myRow) return false;
    return branchRest.some((e) => e.id === myId) || myRow.rank <= 3;
  }, [branchRest, myRow, myId]);

  return (
    <div className="min-h-screen bg-[#fffaf0] pb-8">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 pt-4 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Trophy size={20} className="text-[#fbbf24]" />
            <h1 className="text-[#0f172a] text-lg font-extrabold flex-1">
              Reyting
            </h1>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded-full px-2 py-0.5 uppercase tracking-wider">
              <TimerReset size={11} /> {reset.days} kun {reset.hours} soat
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab('branch')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
                tab === 'branch'
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-[#64748b] border-[#ede9e1]'
              }`}
            >
              <Building2 size={14} /> Filial
            </button>
            <button
              onClick={() => setTab('national')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
                tab === 'national'
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-[#64748b] border-[#ede9e1]'
              }`}
            >
              <Globe size={14} /> Milliy
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">
        {tab === 'national' && (
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                  period === p
                    ? 'bg-[#0f172a] text-white'
                    : 'bg-white border border-[#ede9e1] text-[#64748b]'
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
              <div
                key={i}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#fffaf0]" />
                  <div className="h-4 bg-[#fffaf0] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'branch' ? (
          branch.length === 0 ? (
            <EmptyBlock />
          ) : (
            <>
              <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <Podium entries={branchPodium} myId={myId} />
                <div className="px-4 pb-3 -mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-[#10b981] inline-flex items-center gap-1">
                    <ArrowUp size={11} /> Yuqorilash {PROMOTE_TOP}
                  </span>
                  <span className="text-[#ef4444] inline-flex items-center gap-1">
                    Pasayish {DEMOTE_BOTTOM} <ArrowDown size={11} />
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {branchRest.map((e, idx) => {
                  const promotion = idx < PROMOTE_TOP - 3;
                  const demotion = idx >= branchRest.length - DEMOTE_BOTTOM;
                  return (
                    <RankRow
                      key={e.id}
                      rank={e.rank}
                      name={e.name}
                      xp={e.totalXp}
                      streak={e.streak}
                      isMe={e.id === myId}
                      promotion={promotion}
                      demotion={demotion}
                    />
                  );
                })}
              </div>

              {/* Pinned current user — only when far from view */}
              {myRow && !myRowVisible && (
                <div className="sticky bottom-2 z-10">
                  <RankRow
                    rank={myRow.rank}
                    name={myRow.name}
                    xp={myRow.totalXp}
                    streak={myRow.streak}
                    isMe
                    pinned
                  />
                </div>
              )}
            </>
          )
        ) : national.length === 0 ? (
          <EmptyBlock />
        ) : (
          <>
            <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] overflow-hidden">
              <Podium
                entries={national.slice(0, 3).map((e) => ({
                  id: e.alias,
                  name: e.alias,
                  xp: e.xp,
                  rank: e.rank,
                }))}
              />
            </div>
            <div className="space-y-2">
              {national
                .filter((e) => e.rank > 3)
                .map((e) => (
                  <RankRow
                    key={`${e.rank}-${e.alias}`}
                    rank={e.rank}
                    name={e.alias}
                    xp={e.xp}
                  />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RankRow({
  rank,
  name,
  xp,
  streak,
  isMe,
  pinned,
  promotion,
  demotion,
}: {
  rank: number;
  name: string;
  xp: number;
  streak?: number;
  isMe?: boolean;
  pinned?: boolean;
  promotion?: boolean;
  demotion?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-[18px] border-[1.5px] p-3 flex items-center gap-3 transition-colors ${
        isMe
          ? 'border-[#58cc02] bg-[#f0fdf4] shadow-md'
          : promotion
            ? 'border-[#bbf7d0]'
            : demotion
              ? 'border-[#fecaca]'
              : 'border-[#ede9e1]'
      } ${pinned ? 'shadow-2xl' : ''}`}
    >
      <div className="w-8 h-8 rounded-full bg-[#fffaf0] border border-[#ede9e1] flex items-center justify-center shrink-0">
        <span className="text-xs font-extrabold text-[#64748b]">{rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#0f172a] truncate">
          {name}{' '}
          {isMe && (
            <span className="text-[10px] font-extrabold text-white bg-[#58cc02] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Siz
            </span>
          )}
        </p>
        {typeof streak === 'number' && (
          <div className="flex items-center gap-1 mt-0.5">
            <Flame size={11} className="text-[#ef4444]" />
            <span className="text-[10px] text-[#64748b]">
              {streak} kun streak
            </span>
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-[#fbbf24] font-extrabold text-base font-mono tabular-nums">
          {xp}
        </p>
        <p className="text-[#94a3b8] text-[10px] uppercase tracking-wider font-bold">
          XP
        </p>
      </div>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center">
      <Mascot expression="sleeping" size={120} className="mx-auto" />
      <p className="text-[#0f172a] font-bold mt-3">Reyting hali boʻsh</p>
      <p className="text-[#64748b] text-sm mt-1">
        Birinchi darsingizni tugatib, reytingga qoʻshiling.
      </p>
    </div>
  );
}
