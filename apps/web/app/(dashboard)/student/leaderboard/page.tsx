'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Building2,
  Globe,
  Flame,
  ArrowUp,
  ArrowDown,
  TimerReset,
  ArrowLeft,
  Crown,
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

  // Position trajectory hint for the my-rank hero card.
  const myZone: 'promote' | 'safe' | 'demote' | null = useMemo(() => {
    if (!myRow) return null;
    if (myRow.rank <= PROMOTE_TOP) return 'promote';
    if (branch.length > 0 && myRow.rank > branch.length - DEMOTE_BOTTOM)
      return 'demote';
    return 'safe';
  }, [myRow, branch.length]);

  return (
    <div className="min-h-full bg-[#fffaf0] pb-4">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/95 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 pt-3 pb-3">
        <div className="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/student"
              aria-label="Orqaga"
              className="w-9 h-9 min-h-[44px] min-w-[44px] rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-[#0f172a] text-lg md:text-xl font-extrabold leading-tight flex items-center gap-2">
                <Trophy size={18} className="text-[#fbbf24]" />
                Reyting
              </h1>
              <p className="text-[11px] text-[#64748b] font-semibold leading-snug">
                Haftalik liga · {reset.days} kun {reset.hours} soat qoldi
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded-full px-2 py-1 uppercase tracking-wider shrink-0">
              <TimerReset size={11} />
              {reset.days}k {reset.hours}s
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab('branch')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 md:py-2.5 min-h-[44px] rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
                tab === 'branch'
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-[#64748b] border-[#ede9e1]'
              }`}
            >
              <Building2 size={14} /> Filial
            </button>
            <button
              onClick={() => setTab('national')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 md:py-2.5 min-h-[44px] rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
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

      <div className="px-4 md:px-6 pt-4 pb-6 space-y-4 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl md:space-y-5">
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

        {/* My-rank hero card — only on the branch tab where we know who I am */}
        {tab === 'branch' && myRow && !loading && (
          <MyRankHero entry={myRow} zone={myZone} totalEntries={branch.length} />
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 animate-pulse"
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
              {/* Podium card */}
              <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] overflow-hidden">
                <Podium entries={branchPodium} myId={myId} />
                <ZoneLegend />
              </div>

              {/* Promote zone — top of the rest list, visually separated */}
              {branchRest.length > 0 && (
                <ZoneSection
                  label={`Yuqorilash zonasi · top ${PROMOTE_TOP}`}
                  color="emerald"
                  entries={branchRest.slice(0, PROMOTE_TOP - 3)}
                  myId={myId}
                  zone="promote"
                />
              )}

              {/* Safe middle zone */}
              {branchRest.length > PROMOTE_TOP - 3 + DEMOTE_BOTTOM && (
                <ZoneSection
                  label="O'rta zona"
                  color="slate"
                  entries={branchRest.slice(
                    PROMOTE_TOP - 3,
                    branchRest.length - DEMOTE_BOTTOM,
                  )}
                  myId={myId}
                  zone="safe"
                />
              )}

              {/* Demote zone — bottom */}
              {branchRest.length >= DEMOTE_BOTTOM && (
                <ZoneSection
                  label={`Pasayish zonasi · oxirgi ${DEMOTE_BOTTOM}`}
                  color="rose"
                  entries={branchRest.slice(
                    Math.max(PROMOTE_TOP - 3, branchRest.length - DEMOTE_BOTTOM),
                  )}
                  myId={myId}
                  zone="demote"
                />
              )}

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
            <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] overflow-hidden">
              <Podium
                entries={national.slice(0, 3).map((e) => ({
                  id: e.alias,
                  name: e.alias,
                  xp: e.xp,
                  rank: e.rank,
                }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

function MyRankHero({
  entry,
  zone,
  totalEntries,
}: {
  entry: BranchEntry;
  zone: 'promote' | 'safe' | 'demote' | null;
  totalEntries: number;
}) {
  const tone =
    zone === 'promote'
      ? {
          bg: 'from-emerald-500 to-emerald-700',
          accent: 'bg-emerald-300/30',
          label: 'Yuqorilash zonasida',
          icon: <ArrowUp size={14} />,
          hint: "Hafta oxirigacha shu zonada qolsangiz, keyingi ligaga ko'tarilasiz",
        }
      : zone === 'demote'
        ? {
            bg: 'from-rose-500 to-rose-700',
            accent: 'bg-rose-300/30',
            label: 'Pasayish xavfi',
            icon: <ArrowDown size={14} />,
            hint: 'Yana XP toplang — pastga tushib ketmang',
          }
        : {
            bg: 'from-[#0f172a] to-[#1e293b]',
            accent: 'bg-amber-300/20',
            label: "O'rta zona",
            icon: <Trophy size={14} />,
            hint: "Yuqorilash zonasiga chiqish uchun XP toplang",
          };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tone.bg} text-white shadow-lg`}
    >
      <div
        aria-hidden
        className={`absolute -top-10 -right-10 w-44 h-44 rounded-full ${tone.accent}`}
      />
      <div className="relative z-10 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-extrabold text-lg">
            #{entry.rank}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest opacity-80 font-extrabold">
              Sizning oʻrningiz
            </p>
            <p className="text-xl font-extrabold truncate">
              {entry.rank}-o&apos;rin
            </p>
            <p className="text-[11px] opacity-80 font-bold">
              {totalEntries} ta ishtirokchidan
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 backdrop-blur">
            {tone.icon}
            {tone.label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider opacity-80 font-extrabold">
              XP
            </p>
            <p className="text-base font-extrabold tabular-nums">
              {entry.totalXp.toLocaleString()}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-2">
            <Flame size={14} />
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-80 font-extrabold">
                Streak
              </p>
              <p className="text-base font-extrabold tabular-nums">
                {entry.streak}
              </p>
            </div>
          </div>
        </div>
        <p className="text-[11px] opacity-90 font-bold leading-snug">
          {tone.hint}
        </p>
      </div>
    </div>
  );
}

function ZoneLegend() {
  return (
    <div className="px-4 pb-3 -mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider font-extrabold">
      <span className="text-emerald-700 inline-flex items-center gap-1">
        <ArrowUp size={11} /> Yuqorilash {PROMOTE_TOP}
      </span>
      <span className="text-rose-600 inline-flex items-center gap-1">
        Pasayish {DEMOTE_BOTTOM} <ArrowDown size={11} />
      </span>
    </div>
  );
}

function ZoneSection({
  label,
  color,
  entries,
  myId,
  zone,
}: {
  label: string;
  color: 'emerald' | 'slate' | 'rose';
  entries: BranchEntry[];
  myId: string;
  zone: 'promote' | 'safe' | 'demote';
}) {
  if (entries.length === 0) return null;
  const labelColor =
    color === 'emerald'
      ? 'text-emerald-700'
      : color === 'rose'
        ? 'text-rose-600'
        : 'text-[#64748b]';
  const dot =
    color === 'emerald'
      ? 'bg-emerald-500'
      : color === 'rose'
        ? 'bg-rose-500'
        : 'bg-slate-400';

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <p
          className={`text-[10px] font-extrabold uppercase tracking-widest ${labelColor}`}
        >
          {label}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {entries.map((e) => (
          <RankRow
            key={e.id}
            rank={e.rank}
            name={e.name}
            xp={e.totalXp}
            streak={e.streak}
            isMe={e.id === myId}
            promotion={zone === 'promote'}
            demotion={zone === 'demote'}
          />
        ))}
      </div>
    </section>
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
      className={`bg-white rounded-2xl border-[1.5px] p-3 flex items-center gap-3 transition-colors ${
        isMe
          ? 'border-[#58cc02] bg-[#f0fdf4] shadow-md ring-2 ring-[#58cc02]/20'
          : promotion
            ? 'border-emerald-200 bg-emerald-50/30'
            : demotion
              ? 'border-rose-200 bg-rose-50/30'
              : 'border-[#ede9e1]'
      } ${pinned ? 'shadow-2xl' : ''}`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
          rank === 1
            ? 'bg-gradient-to-br from-[#fde68a] to-[#fbbf24] border-[#fbbf24]'
            : rank === 2
              ? 'bg-gradient-to-br from-slate-200 to-slate-400 border-slate-300'
              : rank === 3
                ? 'bg-gradient-to-br from-amber-200 to-amber-500 border-amber-400'
                : 'bg-[#fffaf0] border-[#ede9e1]'
        }`}
      >
        {rank <= 3 ? (
          <Crown size={14} className="text-white drop-shadow-sm" fill="white" />
        ) : (
          <span className="text-xs font-extrabold text-[#64748b]">{rank}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-[#0f172a] truncate">
          {name}
          {isMe && (
            <span className="ml-1.5 text-[9px] font-extrabold text-white bg-[#58cc02] px-1.5 py-0.5 rounded-full uppercase tracking-wider align-middle">
              Siz
            </span>
          )}
        </p>
        {typeof streak === 'number' && (
          <div className="flex items-center gap-1 mt-0.5">
            <Flame size={11} className="text-[#ef4444]" />
            <span className="text-[10px] text-[#64748b] font-bold">
              {streak} kun streak
            </span>
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-[#fbbf24] font-extrabold text-base font-mono tabular-nums">
          {xp.toLocaleString()}
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
    <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-8 text-center">
      <Mascot expression="sleeping" size={120} className="mx-auto" />
      <p className="text-[#0f172a] font-bold mt-3">Reyting hali boʻsh</p>
      <p className="text-[#64748b] text-sm mt-1">
        Birinchi darsingizni tugatib, reytingga qoʻshiling.
      </p>
    </div>
  );
}
