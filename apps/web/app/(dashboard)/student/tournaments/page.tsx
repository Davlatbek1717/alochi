'use client';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

type Tournament = {
  id: string;
  title: string;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string;
  _count: { registrations: number };
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Tournament[]>('/tournaments', {}, token)
      .then((r) => setTournaments(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRegister(tournamentId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setRegistering(tournamentId);
    try {
      await apiRequest(`/tournaments/${tournamentId}/register`, { method: 'POST' }, token);
      setRegistered((prev) => new Set([...prev, tournamentId]));
    } catch {
      // silently ignore duplicate registration
    } finally {
      setRegistering(null);
    }
  }

  const typeLabel = (t: string) => t === '1v1' ? '⚔️ 1v1' : '👥 Guruh';
  const statusLabel = (s: string) => s === 'upcoming' ? '🔜 Kelayotgan' : s === 'active' ? '🟢 Faol' : s;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">🏟️ Turnirlar</h1>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400">
          <p className="text-4xl mb-2">🏟️</p>
          <p>Hozircha turnirlar yo&apos;q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div key={t.id} className="bg-white rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {typeLabel(t.type)} · {statusLabel(t.status)}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                  {t._count.registrations} ishtirokchi
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {new Date(t.startsAt).toLocaleDateString('uz-UZ')} —{' '}
                {new Date(t.endsAt).toLocaleDateString('uz-UZ')}
              </div>
              {t.status === 'upcoming' && (
                <button
                  onClick={() => handleRegister(t.id)}
                  disabled={registering === t.id || registered.has(t.id)}
                  className="w-full py-2 rounded-xl text-sm font-medium transition-colors
                    bg-indigo-600 hover:bg-indigo-500 text-white
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registered.has(t.id)
                    ? "✅ Ro'yxatdan o'tdingiz"
                    : registering === t.id
                    ? "Ro'yxatdan o'tilmoqda..."
                    : "Ro'yxatdan o'tish"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
