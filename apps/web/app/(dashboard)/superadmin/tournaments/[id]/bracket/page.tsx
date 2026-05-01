'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Player = { id: string; name: string } | null;
type Match = { matchId: string; a: Player; b: Player };
type Bracket = { tournamentId: string; players: { id: string; name: string }[]; rounds: Match[][] };

export default function TournamentBracketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Bracket>(`/tournaments/${id}/bracket`, {}, token)
      .then((res) => setBracket(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} className="text-amber-500" />
        <h1 className="text-xl font-bold text-[#0f172a]">Turnir setkasi</h1>
      </div>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : !bracket ? (
        <p className="text-[#64748b] text-sm">Maʼlumot topilmadi</p>
      ) : bracket.players.length === 0 ? (
        <p className="text-[#64748b] text-sm">Hali ishtirokchilar yoʻq</p>
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
                    {m.a?.name ?? <span className="text-[#94a3b8]">—</span>}
                  </p>
                  <div className="border-t border-[#ede9e1]" />
                  <p className="text-sm text-[#0f172a]">
                    {m.b?.name ?? <span className="text-[#94a3b8]">—</span>}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
