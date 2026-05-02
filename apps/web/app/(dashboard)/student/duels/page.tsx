'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Swords,
  Clock,
  CheckCircle,
  Crown,
  Plus,
  ArrowLeft,
  Trophy,
  Minus,
  ArrowRight,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';

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

function getMyId(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string };
    return u.id ?? '';
  } catch {
    return '';
  }
}

function relativeRemaining(iso: string): {
  text: string;
  urgent: boolean;
  expired: boolean;
} {
  const now = Date.now();
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return { text: '', urgent: false, expired: false };
  const diff = end - now;
  if (diff <= 0) return { text: 'Tugadi', urgent: false, expired: true };
  const min = Math.floor(diff / 60000);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return { text: `${days} kun`, urgent: false, expired: false };
  if (hours > 0) return { text: `${hours} soat`, urgent: false, expired: false };
  return { text: `${min} daqiqa`, urgent: min < 30, expired: false };
}

const STATUS_LABEL: Record<DuelStatus, string> = {
  pending: 'Kutilmoqda',
  active: 'Faol',
  completed: 'Tugagan',
  expired: 'Muddati oʻtgan',
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const myId = useMemo(() => getMyId(), []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Duel[]>('/social/duels', {}, token)
      .then((r) => setDuels(r.data ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'),
      )
      .finally(() => setLoading(false));
  }, []);

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
    const decided = won + lost;
    const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;
    return { won, lost, draw, winRate };
  }, [duels, myId]);

  return (
    <div className="min-h-full bg-[#fffaf0] pb-28">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/95 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#0f172a] text-lg font-extrabold leading-tight flex items-center gap-2">
              <Swords size={18} className="text-[#ce82ff]" />
              Duellar
            </h1>
            <p className="text-[11px] text-[#64748b] font-semibold">
              Do&apos;stlar bilan bilim musobaqasi
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-5 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Win-rate stats card — only after the student has completed
            at least one duel. Hides for fresh accounts so they don't
            see "0% win rate" as their first impression. */}
        {stats.won + stats.lost + stats.draw > 0 && (
          <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold uppercase tracking-widest text-[#0f172a]">
                Statistika
              </p>
              {stats.won + stats.lost > 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    stats.winRate >= 60
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : stats.winRate >= 40
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  <Trophy size={11} /> {stats.winRate}% gʻalaba
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatPill
                value={stats.won}
                label="Gʻolib"
                color="text-emerald-700 bg-emerald-50 border-emerald-200"
              />
              <StatPill
                value={stats.lost}
                label="Magʻlub"
                color="text-rose-700 bg-rose-50 border-rose-200"
              />
              <StatPill
                value={stats.draw}
                label="Durang"
                color="text-slate-700 bg-slate-50 border-slate-200"
              />
            </div>
          </div>
        )}

        {/* Big "new duel" CTA */}
        <Link
          href="/student/friends"
          className="group block bg-[#58cc02] hover:brightness-105 rounded-3xl border-b-[4px] border-[#46a302] px-5 py-4 text-white active:translate-y-[2px] active:border-b-[2px] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Plus size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold uppercase tracking-wide">
                Yangi duel boshlash
              </p>
              <p className="text-[11px] opacity-90 font-bold leading-snug mt-0.5">
                Doʻstingizni tanlang va kim ustun ekanini koʻring
              </p>
            </div>
            <ArrowRight size={18} className="opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" theme="light" />
            ))}
          </div>
        ) : duels.length === 0 ? (
          /* Encouraging empty state — Aloqush is HAPPY here, not sad,
             since "no duels yet" is just an unstarted journey. */
          <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-6 text-center space-y-3">
            <Mascot expression="happy" size={104} className="mx-auto" />
            <div>
              <p className="text-[#0f172a] font-extrabold text-base">
                Birinchi duelingizga tayyormisiz?
              </p>
              <p className="text-[#64748b] text-sm font-semibold mt-1 leading-snug">
                Doʻstingizni tanlang va 30 daqiqada kim ko‘proq XP toplaydi —
                bilim musobaqasi
              </p>
            </div>
          </div>
        ) : (
          <>
            {grouped.active.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
                    Faol duellar
                  </p>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    {grouped.active.length} ta
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {grouped.active.map((d) => (
                    <DuelRow key={d.id} duel={d} myId={myId} />
                  ))}
                </div>
              </section>
            )}
            {grouped.completed.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
                    Tugagan duellar
                  </p>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    {grouped.completed.length} ta
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {grouped.completed.map((d) => (
                    <DuelRow key={d.id} duel={d} myId={myId} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 text-center ${color}`}
    >
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
        {label}
      </p>
    </div>
  );
}

function DuelRow({ duel, myId }: { duel: Duel; myId: string }) {
  const isChallenger = duel.challengerId === myId;
  const opponentName = isChallenger ? duel.challengedName : duel.challengerName;
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
  const oppScore = isChallenger ? duel.challengedScore : duel.challengerScore;

  const outcome = outcomeFor(duel, myId);
  const ctaLabel =
    duel.status === 'active' || duel.status === 'pending'
      ? 'Davom ettir'
      : 'Natija';
  const remaining =
    duel.status === 'active' || duel.status === 'pending'
      ? relativeRemaining(duel.expiresAt)
      : null;
  const isActive = duel.status === 'active' || duel.status === 'pending';

  return (
    <Link
      href={`/student/duel/${duel.id}`}
      className={`block rounded-3xl border-[1.5px] overflow-hidden transition-colors ${
        isActive
          ? remaining?.urgent
            ? 'bg-white border-[#fecaca] shadow-md'
            : 'bg-white border-[#a7f3d0] shadow-sm'
          : outcome === 'won'
            ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
            : outcome === 'lost'
              ? 'bg-gradient-to-br from-rose-50 to-white border-rose-200'
              : 'bg-white border-[#ede9e1] hover:border-[#cbd5e1]'
      }`}
    >
      <div className="p-3 flex items-center gap-3">
        <Avatar name="Siz" winner={outcome === 'won'} />
        <span className="text-[#94a3b8] font-extrabold text-xs uppercase tracking-wider">
          vs
        </span>
        <Avatar name={opponentName} winner={outcome === 'lost'} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-extrabold text-[#0f172a] truncate">
              {opponentName}
            </p>
            <StatusPill status={duel.status} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-[#64748b] tabular-nums">
              <span className="font-mono font-extrabold text-[#0f172a]">
                {myScore}
              </span>
              <span className="mx-1.5 text-[#94a3b8]">:</span>
              <span className="font-mono font-extrabold text-[#0f172a]">
                {oppScore}
              </span>
              {outcome && <OutcomeChip outcome={outcome} />}
            </p>
            <span
              className={`text-[10px] font-extrabold inline-flex items-center gap-1 ${
                remaining?.urgent ? 'text-[#ef4444]' : 'text-[#1cb0f6]'
              }`}
            >
              {duel.status === 'completed' ? (
                <CheckCircle size={11} />
              ) : (
                <Clock size={11} />
              )}
              {remaining ? remaining.text : ctaLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom result ribbon for completed duels — much louder than
          the inline "Gʻolibsiz" text the previous design used. */}
      {outcome && (
        <div
          className={`px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-center ${
            outcome === 'won'
              ? 'bg-emerald-500 text-white'
              : outcome === 'lost'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-400 text-white'
          }`}
        >
          {outcome === 'won' && (
            <span className="inline-flex items-center gap-1.5">
              <Crown size={12} fill="currentColor" /> Gʻolibsiz · +{duel.xpEarned ?? 0} XP
            </span>
          )}
          {outcome === 'lost' && 'Magʻlubiyat — qayta uriniб ko‘ring'}
          {outcome === 'draw' && (
            <span className="inline-flex items-center gap-1.5">
              <Minus size={12} /> Durang
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function OutcomeChip({ outcome }: { outcome: DuelOutcome }) {
  if (!outcome) return null;
  return (
    <span
      className={`ml-2 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
        outcome === 'won'
          ? 'bg-emerald-100 text-emerald-700'
          : outcome === 'lost'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      {outcome === 'won' ? '+' : outcome === 'lost' ? '−' : '='}
    </span>
  );
}

function StatusPill({ status }: { status: DuelStatus }) {
  return (
    <span
      className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        status === 'active'
          ? 'bg-[#ecfdf5] text-[#10b981] border-[#a7f3d0]'
          : status === 'pending'
            ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'
            : status === 'completed'
              ? 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]'
              : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Avatar({ name, winner }: { name: string; winner?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div
        className={`w-10 h-10 rounded-full border-2 border-white shadow flex items-center justify-center text-white font-extrabold text-sm bg-gradient-to-br ${
          winner
            ? 'from-emerald-400 to-emerald-600'
            : 'from-[#fbbf24] to-[#d97706]'
        }`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      {winner && (
        <Crown
          size={14}
          fill="#fbbf24"
          className="absolute -top-2 left-1/2 -translate-x-1/2 text-[#fbbf24] drop-shadow-sm"
        />
      )}
    </div>
  );
}
