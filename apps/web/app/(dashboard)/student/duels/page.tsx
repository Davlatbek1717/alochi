'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Swords,
  Clock,
  CheckCircle,
  Crown,
  Plus,
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

  return (
    <div className="min-h-full bg-[#fffaf0] pb-8">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Swords size={20} className="text-[#ce82ff]" />
          <h1 className="text-[#0f172a] text-lg font-extrabold">Duellar</h1>
        </div>
      </header>

      <div className="px-4 pt-5 pb-6 space-y-5 max-w-lg mx-auto">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {/* Big CTA */}
        <Link
          href="/student/friends"
          className="group block bg-[#58cc02] hover:brightness-105 rounded-[20px] border-b-[4px] border-[#46a302] px-5 py-4 text-white font-extrabold uppercase tracking-wide active:translate-y-[2px] active:border-b-[2px] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus size={22} />
            </div>
            <div className="flex-1">
              <p className="text-base">Yangi duel boshlash</p>
              <p className="text-[10px] opacity-90 normal-case font-semibold tracking-normal">
                Doʻstingizni tanlang va kim ustun ekanini koʻring
              </p>
            </div>
          </div>
        </Link>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" theme="light" />
            ))}
          </div>
        ) : duels.length === 0 ? (
          <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-4">
            <Mascot expression="sad" size={120} className="mx-auto" />
            <div>
              <p className="text-[#0f172a] font-bold text-lg">
                Hali do&apos;stlaringiz bilan duel boshlamadingiz
              </p>
              <p className="text-[#64748b] text-sm mt-1">
                Doʻstlar sahifasidan kimnidir tanlang va musobaqa boshlang.
              </p>
            </div>
            <Link
              href="/student/friends"
              className="inline-block bg-[#58cc02] text-white font-extrabold uppercase tracking-wide px-6 py-2.5 rounded-2xl border-b-[3px] border-[#46a302] active:translate-y-[1px] active:border-b-[1px]"
            >
              Boshlash
            </Link>
          </div>
        ) : (
          <>
            {grouped.active.length > 0 && (
              <section>
                <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2">
                  Faol duellar ({grouped.active.length})
                </p>
                <div className="space-y-2">
                  {grouped.active.map((d) => (
                    <DuelRow key={d.id} duel={d} myId={myId} />
                  ))}
                </div>
              </section>
            )}
            {grouped.completed.length > 0 && (
              <section>
                <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2">
                  Tugagan duellar ({grouped.completed.length})
                </p>
                <div className="space-y-2">
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

function DuelRow({ duel, myId }: { duel: Duel; myId: string }) {
  const isChallenger = duel.challengerId === myId;
  const opponentName = isChallenger ? duel.challengedName : duel.challengerName;
  const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
  const oppScore = isChallenger ? duel.challengedScore : duel.challengerScore;
  const won =
    duel.status === 'completed' && duel.winner && duel.winner === myId;
  const lost =
    duel.status === 'completed' &&
    duel.winner &&
    duel.winner !== myId &&
    duel.challengerScore !== duel.challengedScore;
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
      className={`block bg-white rounded-[18px] border-[1.5px] p-3 transition-colors ${
        isActive
          ? remaining?.urgent
            ? 'border-[#fecaca] shadow-md'
            : 'border-[#a7f3d0] shadow-sm'
          : 'border-[#ede9e1] hover:border-[#cbd5e1]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Me avatar */}
        <Avatar name="Siz" winner={Boolean(won)} />
        <span className="text-[#94a3b8] font-extrabold text-sm">vs</span>
        {/* Opp avatar */}
        <Avatar name={opponentName} winner={Boolean(lost)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#0f172a] truncate">
              {opponentName}
            </p>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                duel.status === 'active'
                  ? 'bg-[#ecfdf5] text-[#10b981] border-[#a7f3d0]'
                  : duel.status === 'pending'
                    ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'
                    : duel.status === 'completed'
                      ? 'bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]'
                      : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
              }`}
            >
              {STATUS_LABEL[duel.status]}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[#64748b] tabular-nums">
              <span className="font-mono font-extrabold text-[#0f172a]">
                {myScore}
              </span>
              <span className="mx-1.5 text-[#94a3b8]">:</span>
              <span className="font-mono font-extrabold text-[#0f172a]">
                {oppScore}
              </span>
              {duel.status === 'completed' && (
                <span
                  className={`ml-2 font-bold ${
                    won
                      ? 'text-[#10b981]'
                      : duel.challengerScore === duel.challengedScore
                        ? 'text-[#94a3b8]'
                        : 'text-[#ef4444]'
                  }`}
                >
                  {won
                    ? 'Gʻolibsiz'
                    : duel.challengerScore === duel.challengedScore
                      ? 'Durang'
                      : 'Magʻlubiyat'}
                </span>
              )}
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
    </Link>
  );
}

function Avatar({ name, winner }: { name: string; winner?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#d97706] border-2 border-white shadow flex items-center justify-center text-white font-extrabold text-sm">
        {name.charAt(0).toUpperCase()}
      </div>
      {winner && (
        <Crown
          size={14}
          fill="#fbbf24"
          className="absolute -top-2 left-1/2 -translate-x-1/2 text-[#fbbf24]"
        />
      )}
    </div>
  );
}

