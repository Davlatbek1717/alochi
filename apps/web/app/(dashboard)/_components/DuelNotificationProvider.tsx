'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';

interface DuelChallenge {
  duelId: string;
  challengerName: string;
}

interface DuelResult {
  won: boolean;
  xpEarned: number;
  score: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function DuelNotificationProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [challenge, setChallenge] = useState<DuelChallenge | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string };
    if (user.role !== 'student') return;

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

      {challenge && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-indigo-200 p-4 w-80 animate-in slide-in-from-top-2">
          <p className="font-bold text-gray-900 text-center mb-1">⚔️ Duel taklifi!</p>
          <p className="text-sm text-gray-600 text-center mb-4">
            <span className="font-medium">{challenge.challengerName}</span> sizni duelga chaqirdi
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptDuel}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold"
            >
              Qabul ✓
            </button>
            <button
              onClick={rejectDuel}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-xl text-sm"
            >
              Rad ✗
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-2xl shadow-xl px-6 py-3 text-white text-center animate-in slide-in-from-bottom-2 ${result.won ? 'bg-green-500' : 'bg-gray-600'}`}>
          <p className="font-bold">{result.won ? '🏆 G\'alaba!' : '😔 Mag\'lubiyat'}</p>
          <p className="text-sm opacity-90">+{result.xpEarned} XP · {result.score}</p>
        </div>
      )}
    </>
  );
}
