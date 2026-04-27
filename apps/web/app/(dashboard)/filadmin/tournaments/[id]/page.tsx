'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Trophy, Users, Calendar } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Registration = {
  id: string;
  studentId: string;
  createdAt: string;
  student?: { name: string };
};

type Tournament = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
};

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Tournament[]>('/tournaments', {}, token),
      apiRequest<Registration[]>(`/tournaments/${tournamentId}/registrations`, {}, token),
    ]).then(([listRes, regRes]) => {
      const found = (listRes.data ?? []).find((t) => t.id === tournamentId);
      setTournament(found ?? null);
      setRegistrations(regRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [tournamentId]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }}
        />
        <button
          onClick={() => router.push('/filadmin/tournaments')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-5 relative z-10"
        >
          <ArrowLeft size={16} /> Turnirlar
        </button>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={14} className="text-[#f59e0b]" />
            <span className="text-[#f59e0b] text-xs font-semibold uppercase tracking-wider">Turnir</span>
          </div>
          <p className="text-white text-xl font-bold">{tournament?.title ?? 'Yuklanmoqda...'}</p>
          {tournament && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[#94a3b8]">
                {tournament.type}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                <Calendar size={10} />
                {formatDate(tournament.startsAt)} {formatTime(tournament.startsAt)} – {formatDate(tournament.endsAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Stat */}
        <div className="bg-[#162032] rounded-[18px] p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center">
            <Users size={20} className="text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-white text-3xl font-black font-mono leading-none">{registrations.length}</p>
            <p className="text-[#94a3b8] text-xs mt-1">Ishtirokchilar</p>
          </div>
        </div>

        {/* Registrations list */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Ishtirokchilar ro&apos;yxati</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : registrations.length === 0 ? (
            <div className="bg-white rounded-[18px] p-8 text-center border-[1.5px] border-[#ede9e1]">
              <Users size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-[#0f172a] font-semibold">Hali ishtirokchilar yo&apos;q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {registrations.map((reg, i) => (
                <div key={reg.id} className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-[#94a3b8] w-6 shrink-0">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                    {(reg.student?.name ?? reg.studentId).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">
                      {reg.student?.name ?? reg.studentId}
                    </p>
                    <p className="text-[#94a3b8] text-[11px]">{formatDate(reg.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
