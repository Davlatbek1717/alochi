'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Users } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';

type Player = { id: string; name: string } | null;
type Match = { matchId: string; a: Player; b: Player };
type Bracket = { tournamentId: string; players: { id: string; name: string }[]; rounds: Match[][] };

export default function TournamentBracketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const toast = useToast();
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Bracket>(`/tournaments/${id}/bracket`, {}, token)
      .then((res) => setBracket(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Yuklab bo\'lmadi'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 space-y-3">
          <button
            onClick={() => router.push('/superadmin/tournaments')}
            className="flex items-center gap-2 text-[#94a3b8] text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Turnirlar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
              <Trophy size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Turnir</p>
              <p className="text-white font-bold text-lg">Turnir setkasi</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 min-w-[200px]">
                  <Skeleton theme="light" className="h-4 w-16" />
                  <Skeleton theme="light" className="h-20 rounded-[18px]" />
                  <Skeleton theme="light" className="h-20 rounded-[18px]" />
                </div>
              ))}
            </div>
          </div>
        ) : !bracket ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Trophy size={28} />}
              title="Setka topilmadi"
              description="Bu turnir uchun bracket hali yaratilmagan"
            />
          </div>
        ) : bracket.players.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Ishtirokchilar yo'q"
              description="Hali hech kim ro'yxatdan o'tmagan"
            />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {bracket.rounds.map((round, i) => (
              <div key={i} className="space-y-3 min-w-[200px]">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                  {i === bracket.rounds.length - 1 ? 'Final' : `${i + 1}-tur`}
                </p>
                {round.map((m) => (
                  <div
                    key={m.matchId}
                    className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3 space-y-2"
                  >
                    <p className="text-sm text-[#0f172a]">
                      {m.a ? m.a.name : <span className="text-[#94a3b8]">—</span>}
                    </p>
                    <div className="border-t border-[#ede9e1]" />
                    <p className="text-sm text-[#0f172a]">
                      {m.b ? m.b.name : <span className="text-[#94a3b8]">—</span>}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
