'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Calendar, Users, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, Mascot, useToast } from '@/components/ui';
import { formatDateShort } from '@/lib/date-uz';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type Tournament = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  _count?: { registrations: number };
};

export default function StudentTournamentsPage() {
  const router = useRouter();
  const toast = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [registering, setRegistering] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    setLoadError('');
    apiRequest<Tournament[]>('/tournaments', {}, token)
      .then((res) => setTournaments(res.data ?? []))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Yuklanmadi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);

  async function handleRegister(tournamentId: string) {
    if (registering) return;
    setRegistering(tournamentId);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/tournaments/${tournamentId}/register`, { method: 'POST' }, token);
      setRegistered((prev) => new Set([...prev, tournamentId]));
      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ro\'yxatdan o\'tib bo\'lmadi');
    } finally {
      setRegistering(null);
    }
  }

  const formatDate = (iso: string) => formatDateShort(iso);

  const isActive = (t: Tournament) => {
    const now = Date.now();
    return new Date(t.startsAt).getTime() <= now && now <= new Date(t.endsAt).getTime();
  };

  const isUpcoming = (t: Tournament) => new Date(t.startsAt).getTime() > Date.now();

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <button
          onClick={() => router.push('/student')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-4 relative z-10 hover:text-white transition-colors min-h-[44px]"
        >
          <ArrowLeft size={16} /> Bosh sahifaga
        </button>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={16} className="text-[#fbbf24]" />
            <span className="text-[#fbbf24] text-xs font-semibold uppercase tracking-wider">Musobaqalar</span>
          </div>
          <p className="text-white text-xl md:text-2xl font-bold">Turnirlar</p>
          <p className="text-[#94a3b8] text-xs md:text-sm mt-1">Qatnashish uchun ro&apos;yxatdan o&apos;ting</p>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-3 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {/* Load error */}
        {loadError && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-rose-200 p-6 text-center space-y-3">
            <Mascot expression="sad" size={80} className="mx-auto" />
            <p className="text-[#0f172a] font-extrabold">Yuklab bo&apos;lmadi</p>
            <p className="text-[#64748b] text-sm">{loadError}</p>
            <p className="text-[#94a3b8] text-xs">Internet aloqasini tekshiring</p>
            <Button variant="duo" size="md" onClick={load}>
              Qayta urinish
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1]">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton theme="light" className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton theme="light" className="h-4 w-2/3 rounded" />
                    <Skeleton theme="light" className="h-3 w-1/2 rounded" />
                  </div>
                </div>
                <Skeleton theme="light" className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : !loadError && tournaments.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Trophy size={28} className="text-[#fbbf24]" />}
              title="Hali turnirlar yo'q"
              description="Tez orada yangi musobaqalar e'lon qilinadi"
            />
          </div>
        ) : !loadError ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournaments.map((t) => {
            const active = isActive(t);
            const upcoming = isUpcoming(t);
            const isReg = registered.has(t.id);
            return (
              <div key={t.id} className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1]">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-[#58cc02]/10' : 'bg-[#fbbf24]/10'}`}>
                    <Trophy size={18} className={active ? 'text-[#58cc02]' : 'text-[#fbbf24]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#0f172a] font-bold text-sm">{t.title}</p>
                      {active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#58cc02]/10 text-[#46a302] border border-[#58cc02]/30">
                          JONLI
                        </span>
                      )}
                      {upcoming && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1cb0f6]/10 text-[#0369a1] border border-[#1cb0f6]/30">
                          KELAYOTGAN
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-[#94a3b8] font-semibold uppercase">{t.type}</span>
                      <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                        <Calendar size={10} /> {formatDate(t.startsAt)}
                      </span>
                      {t._count !== undefined && (
                        <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                          <Users size={10} /> {t._count.registrations} kishi
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isReg ? (
                  <div className="flex items-center gap-2 bg-[#58cc02]/10 border border-[#58cc02]/30 rounded-xl px-4 py-2.5">
                    <CheckCircle size={16} className="text-[#58cc02]" />
                    <span className="text-[#46a302] text-sm font-extrabold">Ro&apos;yxatdan o&apos;tdingiz</span>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    loading={registering === t.id}
                    disabled={!!registering}
                    className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
                    onClick={() => handleRegister(t.id)}
                  >
                    {registering === t.id ? 'Saqlanmoqda...' : 'Ishtirok etish →'}
                  </Button>
                )}
              </div>
            );
          })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
