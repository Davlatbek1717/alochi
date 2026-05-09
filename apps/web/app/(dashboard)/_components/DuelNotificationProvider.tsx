'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Swords, Trophy } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, Button } from '@/components/ui';

/** Dispatch a window-level CustomEvent so any page hook can revalidate. */
function dispatchRevalidate(type: string, payload: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('alochi:revalidate', { detail: { type, payload } }),
  );
}

interface DuelChallenge {
  duelId: string;
  challengerName: string;
}

interface DuelResult {
  won: boolean;
  score: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function DuelNotificationProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [challenge, setChallenge] = useState<DuelChallenge | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    if (!token) return;

    const socket = io(`${BASE_URL}/social`, { auth: { token } });
    socketRef.current = socket;

    socket.on('duel:challenged', (data: DuelChallenge) => {
      setChallenge(data);
      setTimeout(() => setChallenge(null), 30_000);
    });

    socket.on('duel:result', (data: DuelResult) => {
      setResult(data);
      setTimeout(() => setResult(null), 5_000);
    });

    // Revalidation bridge — forward server-push events as window CustomEvents
    // so any page using useRevalidateOnEvent can refetch without polling.
    const REVALIDATE_EVENTS = [
      'cert:earned',
      'status:updated',
      'kpi:updated',
      'challenge:update',
    ] as const;

    for (const event of REVALIDATE_EVENTS) {
      socket.on(event, (payload: unknown) => {
        dispatchRevalidate(event, payload);
      });
    }

    return () => { socket.disconnect(); };
  }, []);

  async function acceptDuel() {
    if (!challenge) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/duels/${challenge.duelId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept: true }),
      }, token);
    } catch { /* ignore */ }
    setChallenge(null);
  }

  function rejectDuel() {
    if (!challenge) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest(`/social/duels/${challenge.duelId}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ accept: false }),
    }, token).catch(() => {});
    setChallenge(null);
  }

  return (
    <>
      {children}

      {/* Duel challenge modal */}
      <Modal
        open={!!challenge}
        onClose={rejectDuel}
        size="sm"
        closeOnOverlay={false}
        theme="dark"
        title="Duel taklifi!"
        description={challenge ? `${challenge.challengerName} sizni duelga chaqirdi` : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={rejectDuel}>
              Rad etish
            </Button>
            <Button variant="primary" size="sm" icon={<Swords size={14} />} onClick={acceptDuel}>
              Qabul qilish
            </Button>
          </>
        }
      >
        <div className="flex justify-center py-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Swords size={28} className="text-indigo-400" />
          </div>
        </div>
      </Modal>

      {/* Duel result toast-like banner */}
      {result && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl shadow-2xl px-6 py-4 text-white text-center animate-in slide-in-from-bottom-2 duration-200 min-w-[200px] ${
            result.won
              ? 'bg-emerald-600 border border-emerald-500/50'
              : 'bg-slate-700 border border-slate-600/50'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Trophy size={18} className={result.won ? 'text-yellow-300' : 'text-slate-400'} />
            <p className="font-bold">{result.won ? "G'alaba!" : "Mag'lubiyat"}</p>
          </div>
          <p className="text-sm opacity-80">Ball: {result.score}</p>
        </div>
      )}
    </>
  );
}
