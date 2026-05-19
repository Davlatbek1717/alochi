'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { Ustoz } from '@/components/Ustoz';

type DuelStatus = 'pending' | 'active' | 'completed' | 'expired';

type Duel = {
  id: string;
  status: DuelStatus;
  challengerId: string;
  challengedId: string;
  challengerName: string;
  challengedName: string;
  challengerScore: number;
  challengedScore: number;
  expiresAt: string;
  winner?: string | null;
  xpEarned?: number;
};

type FriendDuel = {
  id: string;
  challengerName: string;
  challengedName: string;
  challengerScore: number;
  challengedScore: number;
  winnerId: string | null;
  challengerId: string;
  challengedId: string;
};

function getMyId(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.userId ?? payload.sub ?? '') as string;
  } catch {
    return '';
  }
}

function relativeRemaining(iso: string): { text: string; urgent: boolean } {
  const now = Date.now();
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return { text: '', urgent: false };
  const diff = end - now;
  if (diff <= 0) return { text: 'Tugadi', urgent: false };
  const min = Math.floor(diff / 60000);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return { text: `${days} kun`, urgent: false };
  if (hours > 0) return { text: `${hours} soat`, urgent: false };
  return { text: `${min} daqiqa`, urgent: min < 30 };
}

type DuelOutcome = 'won' | 'lost' | 'draw' | null;

function outcomeFor(d: Duel, myId: string): DuelOutcome {
  if (d.status !== 'completed') return null;
  if (d.challengerScore === d.challengedScore) return 'draw';
  if (d.winner === myId) return 'won';
  if (d.winner && d.winner !== myId) return 'lost';
  return null;
}

export default function StudentDuelsPage() {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [friendDuels, setFriendDuels] = useState<FriendDuel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const myId = useMemo(() => getMyId(), []);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setError('');
    apiRequest<Duel[]>('/social/duels', {}, token)
      .then((r) => setDuels(r.data ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'),
      )
      .finally(() => setLoading(false));
    // Best-effort: friends' duel results never block the page.
    apiRequest<FriendDuel[]>('/social/duels/friends', {}, token)
      .then((r) => setFriendDuels(r.data ?? []))
      .catch(() => setFriendDuels([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['status:updated'], load);

  const grouped = useMemo(() => {
    const active: Duel[] = [];
    const completed: Duel[] = [];
    for (const d of duels) {
      if (d.status === 'active' || d.status === 'pending') active.push(d);
      else completed.push(d);
    }
    return { active, completed };
  }, [duels]);

  const stats = useMemo(() => {
    let won = 0;
    let lost = 0;
    let draw = 0;
    for (const d of duels) {
      const o = outcomeFor(d, myId);
      if (o === 'won') won++;
      else if (o === 'lost') lost++;
      else if (o === 'draw') draw++;
    }
    return { won, lost, draw, active: grouped.active.length };
  }, [duels, myId, grouped.active.length]);

  return (
    <div className="sp-theme min-h-full pb-24">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-3xl">
        <Link
          href="/student"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="sp-eyebrow">bilim musobaqalari</div>
          <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
            Duellar
          </h1>
        </div>
        <Link
          href="/student/friends"
          aria-label="Yangi duel"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:translate-y-[2px] transition-transform"
          style={{
            background: 'var(--ember)',
            color: 'var(--bone)',
            border: '1.5px solid var(--ember-deep)',
            boxShadow: '0 3px 0 var(--ember-deep)',
          }}
        >
          <Plus size={20} />
        </Link>
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-3">
        {error && (
          <div
            className="px-4 py-3 text-sm flex items-center justify-between gap-3"
            style={{
              background: 'var(--ember-tint)',
              border: '1.5px solid var(--ember-soft)',
              color: 'var(--ember-deep)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <span>{error}</span>
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

        {/* Stats strip — only after at least one decided/active duel */}
        {(stats.won + stats.lost + stats.draw + stats.active) > 0 && (
          <div className="flex gap-2">
            {[
              { k: "G'alaba", v: stats.won },
              { k: 'Yutqazish', v: stats.lost },
              { k: 'Davom', v: stats.active },
            ].map((s) => (
              <div
                key={s.k}
                className="flex-1 p-2.5 text-center"
                style={{
                  background: 'var(--bone-2)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-2)',
                }}
              >
                <div className="sp-display text-xl" style={{ color: 'var(--ember-deep)' }}>
                  {s.v}
                </div>
                <div className="sp-eyebrow">{s.k}</div>
              </div>
            ))}
          </div>
        )}

        {/* Big new-duel CTA */}
        <Link
          href="/student/friends"
          className="block p-4 active:translate-y-[2px] transition-transform"
          style={{
            background: 'var(--leaf)',
            color: 'var(--bone)',
            border: '2px solid var(--leaf-deep)',
            borderRadius: 'var(--r-3)',
            boxShadow: '0 4px 0 var(--leaf-deep)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <Plus size={22} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="sp-display text-base">Yangi duel boshlash</p>
              <p className="text-[11px] opacity-90 leading-snug mt-0.5">
                Doʻstingizni tanlang va kim ustun ekanini koʻring
              </p>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sp-skeleton h-20" style={{ borderRadius: 'var(--r-3)' }} />
            ))}
          </div>
        ) : duels.length === 0 ? (
          <div
            className="p-6 text-center space-y-3"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-4)',
            }}
          >
            <Ustoz size={104} mood="cheer" className="mx-auto" />
            <div>
              <p className="sp-display text-base" style={{ color: 'var(--ink)' }}>
                Birinchi duelingizga tayyormisiz?
              </p>
              <p className="text-sm mt-1 leading-snug" style={{ color: 'var(--ink-3)' }}>
                Doʻstingizni tanlang va bilimingizni sinab koʻring.
              </p>
            </div>
          </div>
        ) : (
          <>
            {grouped.active.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Faol duellar</SectionLabel>
                <div className="space-y-2.5">
                  {grouped.active.map((d) => (
                    <ActiveDuelCard key={d.id} duel={d} myId={myId} />
                  ))}
                </div>
              </section>
            )}
            {grouped.completed.length > 0 && (
              <section className="space-y-2">
                <SectionLabel>Tugagan</SectionLabel>
                <div className="space-y-1.5">
                  {grouped.completed.map((d) => (
                    <CompletedDuelRow key={d.id} duel={d} myId={myId} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Friends' recent duel results — visible regardless of whether
            the student has their own duels. */}
        {!loading && friendDuels.length > 0 && (
          <section className="space-y-2">
            <SectionLabel>Doʻstlar duellari</SectionLabel>
            <div className="space-y-1.5">
              {friendDuels.map((d) => (
                <FriendDuelRow key={d.id} duel={d} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FriendDuelRow({ duel }: { duel: FriendDuel }) {
  const challengerWon = duel.winnerId === duel.challengerId;
  const challengedWon = duel.winnerId === duel.challengedId;
  return (
    <div
      className="flex items-center gap-3 p-2.5"
      style={{
        background: 'var(--bone-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-2)',
      }}
    >
      <span
        className="w-1.5 h-8 shrink-0"
        style={{ background: 'var(--leaf)', borderRadius: 3 }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] sp-display" style={{ color: 'var(--ink)' }}>
          <span style={{ fontWeight: challengerWon ? 700 : 400 }}>
            {duel.challengerName}
          </span>
          <span style={{ color: 'var(--ink-4)' }}> vs </span>
          <span style={{ fontWeight: challengedWon ? 700 : 400 }}>
            {duel.challengedName}
          </span>
        </div>
        <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {duel.challengerScore} : {duel.challengedScore}
        </div>
      </div>
      <span
        className="sp-mono text-[11px] px-2.5 py-1"
        style={{
          background: 'var(--leaf-tint)',
          color: 'var(--leaf-deep)',
          border: '1px solid var(--leaf-soft)',
          borderRadius: 999,
        }}
      >
        {duel.winnerId
          ? `${challengerWon ? duel.challengerName : duel.challengedName} gʻolib`
          : 'durang'}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="sp-display text-sm uppercase px-1 mt-4"
      style={{ letterSpacing: '0.06em', color: 'var(--ink-3)' }}
    >
      {children}
    </p>
  );
}

function ActiveDuelCard({ duel, myId }: { duel: Duel; myId: string }) {
  const isChallenger = duel.challengerId === myId;
  const opponentName = isChallenger ? duel.challengedName : duel.challengerName;
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
  const oppScore = isChallenger ? duel.challengedScore : duel.challengerScore;
  const total = Math.max(1, myScore + oppScore);
  const remaining =
    duel.status === 'pending'
      ? { text: 'kutilmoqda', urgent: false }
      : relativeRemaining(duel.expiresAt);

  return (
    <Link
      href={`/student/duel/${duel.id}`}
      className="flex items-center gap-3 p-3.5"
      style={{
        background: 'var(--bone)',
        border: `1.5px solid ${remaining.urgent ? 'var(--ember-soft)' : 'var(--line)'}`,
        borderRadius: 'var(--r-3)',
        boxShadow: 'var(--shadow-1)',
      }}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center sp-display shrink-0"
        style={{
          background: 'var(--ember-tint)',
          border: '2px solid var(--ember-deep)',
          color: 'var(--ember-deep)',
          fontWeight: 700,
        }}
      >
        {opponentName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="sp-display text-sm" style={{ color: 'var(--ink)' }}>
          vs {opponentName}
        </div>
        <div className="text-[11px] flex gap-2" style={{ color: 'var(--ink-3)' }}>
          <span>
            {myScore} / {oppScore} savol
          </span>
          <span>·</span>
          <span style={{ color: remaining.urgent ? 'var(--ember-deep)' : 'var(--ink-3)' }}>
            {remaining.text}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="flex-1 h-1.5 overflow-hidden relative"
            style={{ background: 'var(--paper-3)', borderRadius: 3 }}
          >
            <span
              className="absolute left-0 top-0 bottom-0"
              style={{ width: `${(myScore / total) * 100}%`, background: 'var(--leaf)' }}
            />
          </span>
          <span className="sp-mono text-[11px]" style={{ color: 'var(--leaf-deep)' }}>
            {myScore}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--ink-4)' }}>
            vs
          </span>
          <span className="sp-mono text-[11px]" style={{ color: 'var(--ember-deep)' }}>
            {oppScore}
          </span>
          <span
            className="flex-1 h-1.5 overflow-hidden relative"
            style={{ background: 'var(--paper-3)', borderRadius: 3 }}
          >
            <span
              className="absolute right-0 top-0 bottom-0"
              style={{ width: `${(oppScore / total) * 100}%`, background: 'var(--ember)' }}
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CompletedDuelRow({ duel, myId }: { duel: Duel; myId: string }) {
  const isChallenger = duel.challengerId === myId;
  const opponentName = isChallenger ? duel.challengedName : duel.challengerName;
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
  const oppScore = isChallenger ? duel.challengedScore : duel.challengerScore;
  const outcome = outcomeFor(duel, myId);
  const won = outcome === 'won';
  const label = won ? "g'alaba" : outcome === 'lost' ? 'yutqazish' : 'durang';
  const stripe = won ? 'var(--leaf)' : outcome === 'lost' ? 'var(--ember)' : 'var(--ink-4)';

  return (
    <Link
      href={`/student/duel/${duel.id}`}
      className="flex items-center gap-3 p-2.5"
      style={{
        background: 'var(--bone-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-2)',
      }}
    >
      <span
        className="w-1.5 h-8 shrink-0"
        style={{ background: stripe, borderRadius: 3 }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] sp-display" style={{ color: 'var(--ink)' }}>
          {opponentName}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {myScore} : {oppScore}
        </div>
      </div>
      <span
        className="sp-mono text-[11px] px-2.5 py-1"
        style={{
          background: won ? 'var(--leaf-tint)' : outcome === 'lost' ? 'var(--ember-tint)' : 'var(--paper-2)',
          color: won ? 'var(--leaf-deep)' : outcome === 'lost' ? 'var(--ember-deep)' : 'var(--ink-3)',
          border: `1px solid ${won ? 'var(--leaf-soft)' : outcome === 'lost' ? 'var(--ember-soft)' : 'var(--line)'}`,
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
