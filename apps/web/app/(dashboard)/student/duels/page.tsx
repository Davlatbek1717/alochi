'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Swords, Clock, Trophy, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';

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

const STATUS_BADGE: Record<DuelStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-violet-50 text-violet-700 border-violet-200',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
};

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'))
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
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center">
            <Swords size={20} className="text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Oʻquvchi</p>
            <p className="text-white text-lg font-bold">Duellar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-6 max-w-lg mx-auto">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" theme="light" />
            ))}
          </div>
        ) : duels.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Swords size={28} />}
              title="Hozircha duel yoʻq"
              description="Doʻstlar sahifasidan kimdir bilan duel boshlang"
              theme="light"
            />
            <div className="px-5 pb-5">
              <Link
                href="/student/friends"
                className="block text-center bg-[#0f172a] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#1e293b] transition-colors"
              >
                Doʻstlar sahifasi
              </Link>
            </div>
          </div>
        ) : (
          <>
            {grouped.active.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
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
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
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
  const ctaLabel =
    duel.status === 'active' || duel.status === 'pending' ? 'Davom ettir' : 'Natija';
  return (
    <Link
      href={`/student/duel/${duel.id}`}
      className="block bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 hover:border-[#cbd5e1] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
          {duel.status === 'completed' ? (
            <Trophy size={18} className={won ? 'text-[#f59e0b]' : 'text-[#94a3b8]'} />
          ) : duel.status === 'active' ? (
            <Swords size={18} className="text-[#0d9488]" />
          ) : (
            <Clock size={18} className="text-[#f59e0b]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#0f172a] truncate">vs {opponentName}</p>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[duel.status]}`}
            >
              {STATUS_LABEL[duel.status]}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-[#64748b]">
              <span className="font-mono font-bold text-[#0f172a]">{myScore}</span>
              <span className="mx-1.5 text-[#94a3b8]">:</span>
              <span className="font-mono font-bold text-[#0f172a]">{oppScore}</span>
              {duel.status === 'completed' && (
                <span className={`ml-2 ${won ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {won ? 'Gʻolibsiz' : duel.challengerScore === duel.challengedScore ? 'Durang' : 'Magʻlubiyat'}
                </span>
              )}
            </p>
            <span className="text-xs font-semibold text-[#0d9488] inline-flex items-center gap-1">
              {duel.status === 'completed' ? <CheckCircle size={12} /> : <Clock size={12} />}
              {ctaLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
