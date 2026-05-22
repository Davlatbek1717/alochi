'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Ustoz } from '@/components/Ustoz';

type BranchEntry = {
  rank: number;
  id: string;
  name: string;
  completedLessons: number;
  currentStreak: number;
  weeklyCompletedLessons?: number;
};
type NationalEntry = { rank: number; alias: string; completedLessons: number };

const PROMOTE_TOP = 7;

function weeklyResetIn(): { days: number; hours: number } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const target = new Date(now);
  const daysUntilSunday = (7 - dow) % 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(23, 59, 59, 0);
  if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 7);
  const diffMs = target.getTime() - now.getTime();
  return {
    days: Math.floor(diffMs / 86400000),
    hours: Math.floor((diffMs % 86400000) / 3600000),
  };
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'branch' | 'national'>('branch');
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [branch, setBranch] = useState<BranchEntry[]>([]);
  const [national, setNational] = useState<NationalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [myId, setMyId] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as { sub?: string };
      setMyId(payload.sub ?? '');
    } catch { /* ignore malformed token */ }

    setLoadError('');
    Promise.all([
      apiRequest<BranchEntry[]>('/gamification/leaderboard/branch', {}, token).catch(
        () => ({ data: [] as BranchEntry[] }),
      ),
      apiRequest<NationalEntry[]>(
        `/gamification/leaderboard/national?period=${period}`,
        {},
        token,
      ).catch(() => ({ data: [] as NationalEntry[] })),
    ])
      .then(([b, n]) => {
        setBranch(b.data ?? []);
        setNational(n.data ?? []);
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Reyting yuklanmadi'),
      )
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['cert:earned'], load);

  const reset = weeklyResetIn();
  const myRow = useMemo(() => branch.find((e) => e.id === myId), [branch, myId]);

  return (
    <div className="sp-theme min-h-full pb-24">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          borderBottom: '1.5px solid var(--line)',
        }}
      >
        <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-3 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/student"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="sp-eyebrow">qadam bo‘yicha</div>
              <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
                Reyting
              </h1>
            </div>
            <span
              className="sp-mono text-[11px] px-2.5 py-1 shrink-0"
              style={{
                background: 'var(--gold-tint)',
                color: 'var(--gold-deep)',
                border: '1px solid var(--gold-soft)',
                borderRadius: 999,
              }}
            >
              {reset.days}k {reset.hours}s
            </span>
          </div>
          <div className="flex gap-2">
            {(['branch', 'national'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 min-h-[44px] sp-display text-sm transition-colors"
                style={{
                  background: tab === t ? 'var(--ink)' : 'var(--bone-2)',
                  color: tab === t ? 'var(--bone)' : 'var(--ink-3)',
                  border: `1.5px solid ${tab === t ? 'var(--ink)' : 'var(--line)'}`,
                  borderRadius: 'var(--r-2)',
                }}
              >
                {t === 'branch' ? 'Filial' : 'Milliy'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-4 space-y-3">
        {loadError && (
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
            style={{
              background: 'var(--ember-tint)',
              border: '1.5px solid var(--ember-soft)',
              color: 'var(--ember-deep)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={load}
              className="sp-display text-xs underline"
              style={{ fontWeight: 700 }}
            >
              Qayta urinish
            </button>
          </div>
        )}

        {tab === 'national' && (
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="sp-mono text-xs px-4 py-1.5 transition-colors"
                style={{
                  background: period === p ? 'var(--ink)' : 'var(--bone-2)',
                  color: period === p ? 'var(--bone)' : 'var(--ink-3)',
                  border: `1px solid ${period === p ? 'var(--ink)' : 'var(--line)'}`,
                  borderRadius: 999,
                }}
              >
                {p === 'weekly' ? 'Haftalik' : 'Oylik'}
              </button>
            ))}
          </div>
        )}

        {/* My-position card (branch only) */}
        {tab === 'branch' && myRow && !loading && (
          <div
            className="flex items-center gap-3 p-4"
            style={{
              background: 'var(--gold-tint)',
              border: '2px solid var(--gold-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--gold-deep)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center sp-display"
              style={{ background: 'rgba(255,255,255,0.4)', color: 'var(--gold-deep)', fontWeight: 800 }}
            >
              #{myRow.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className="sp-eyebrow" style={{ color: 'var(--gold-deep)' }}>
                Sizning o‘rningiz
              </div>
              <div className="sp-display text-lg" style={{ color: 'var(--ink)' }}>
                {myRow.rank}-o‘rin
              </div>
              <div className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
                {branch.length} ishtirokchidan ·{' '}
                {myRow.rank <= PROMOTE_TOP ? 'yuqorilash zonasida' : 'davom eting'}
              </div>
            </div>
            <div className="text-right">
              <div className="sp-display text-xl" style={{ color: 'var(--leaf-deep)' }}>
                {myRow.completedLessons}
              </div>
              <div className="sp-eyebrow" style={{ fontSize: 9 }}>
                qadam
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="sp-skeleton h-16" style={{ borderRadius: 'var(--r-2)' }} />
            ))}
          </div>
        ) : tab === 'branch' ? (
          branch.length === 0 ? (
            <EmptyBlock />
          ) : (
            <div className="space-y-1.5">
              {branch.map((e) => (
                <RankRow
                  key={e.id}
                  rank={e.rank}
                  name={e.name}
                  qadam={e.completedLessons}
                  streak={e.currentStreak}
                  isMe={e.id === myId}
                />
              ))}
            </div>
          )
        ) : national.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="space-y-1.5">
            {national.map((e) => (
              <RankRow
                key={`${e.rank}-${e.alias}`}
                rank={e.rank}
                name={e.alias}
                qadam={e.completedLessons}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RankRow({
  rank,
  name,
  qadam,
  streak,
  isMe,
}: {
  rank: number;
  name: string;
  qadam: number;
  streak?: number;
  isMe?: boolean;
}) {
  const top = rank <= 3;
  return (
    <div
      className="flex items-center gap-3 px-3.5 py-3"
      style={{
        background: isMe ? 'var(--gold-tint)' : 'var(--bone-2)',
        border: `2px solid ${isMe ? 'var(--gold-deep)' : 'var(--line)'}`,
        borderRadius: 'var(--r-2)',
        boxShadow: isMe ? '0 3px 0 var(--gold-deep)' : 'none',
      }}
    >
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center sp-mono shrink-0"
        style={{
          background: top ? 'var(--gold)' : 'var(--paper-2)',
          color: top ? 'var(--ink)' : 'var(--ink-3)',
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {rank}
      </span>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center sp-display shrink-0"
        style={{
          background: isMe ? 'var(--leaf)' : 'var(--paper-3)',
          color: isMe ? 'var(--bone)' : 'var(--ink-2)',
          border: '2px solid var(--ink)',
          fontWeight: 800,
        }}
      >
        {(name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="sp-display text-sm truncate" style={{ color: 'var(--ink)' }}>
          {name}
          {isMe && (
            <span
              className="sp-mono ml-2 px-1.5 py-0.5 align-middle"
              style={{
                background: 'var(--leaf-tint)',
                color: 'var(--leaf-deep)',
                border: '1px solid var(--leaf-soft)',
                borderRadius: 999,
                fontSize: 9,
              }}
            >
              sen
            </span>
          )}
        </div>
        {typeof streak === 'number' && (
          <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            🔥 {streak} kun zanjir
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="sp-display text-lg" style={{ color: 'var(--leaf-deep)' }}>
          {qadam}
        </div>
        <div className="sp-eyebrow" style={{ fontSize: 9 }}>
          qadam
        </div>
      </div>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div
      className="p-8 text-center"
      style={{
        background: 'var(--bone)',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-4)',
      }}
    >
      <Ustoz size={120} mood="calm" className="mx-auto" />
      <p className="sp-display mt-3" style={{ color: 'var(--ink)' }}>
        Reyting hali bo‘sh
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
        Birinchi darsingizni tugatib, reytingga qo‘shiling.
      </p>
    </div>
  );
}
