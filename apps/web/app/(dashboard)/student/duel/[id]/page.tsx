'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type DuelQuestion = {
  text: string;
  options: string[];
};

type Duel = {
  id: string;
  status: 'pending' | 'active' | 'completed';
  challengerId: string;
  challengerName: string;
  challengedId: string;
  challengedName: string;
  challengerScore: number;
  challengedScore: number;
  questions: DuelQuestion[];
  currentQuestionIdx: number;
  expiresAt: string;
  winner?: string;
  xpEarned?: number;
};

function useCountdown(expiresAt: string | undefined) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!expiresAt) return;

    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Muddati tugagan');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h > 0 ? h + 'soat ' : ''}${m}daq ${s}son`);
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return timeLeft;
}

function getCurrentUserId(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.userId ?? payload.sub ?? '') as string;
  } catch {
    return '';
  }
}

export default function DuelPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  void router;

  const [duel, setDuel] = useState<Duel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [answering, setAnswering] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const timeLeft = useCountdown(duel?.expiresAt);

  const fetchDuel = useCallback(async () => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Duel>(`/social/duels/${id}`, {}, token);
      setDuel(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duel topilmadi');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDuel();
  }, [fetchDuel]);

  async function handleAnswer(optionIdx: number) {
    if (!duel || answering) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setAnswering(true);
    setSelectedAnswer(optionIdx);
    try {
      await apiRequest(`/social/duels/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionIdx: duel.currentQuestionIdx, answer: optionIdx }),
      }, token);
      await fetchDuel();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setAnswering(false);
      setSelectedAnswer(null);
    }
  }

  async function handleRespond(accept: boolean) {
    if (!duel) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/duels/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept }),
      }, token);
      await fetchDuel();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-20 flex justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !duel) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <p className="text-red-500">{error || 'Duel topilmadi'}</p>
      </div>
    );
  }

  const currentQuestion = duel.status === 'active' && duel.questions
    ? duel.questions[duel.currentQuestionIdx]
    : null;

  const statusLabels: Record<string, string> = {
    pending: "Kutilmoqda",
    active: "Faol",
    completed: "Tugagan",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    active: "bg-green-100 text-green-700",
    completed: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-10">
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">⚔️ Duel</h1>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[duel.status]}`}>
            {statusLabels[duel.status]}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-white/80 text-xs">Musobaqa</p>
            <p className="font-bold">{duel.challengerName}</p>
            <p className="text-3xl font-black">{duel.challengerScore}</p>
          </div>
          <div className="text-2xl font-black text-white/60">VS</div>
          <div className="text-center">
            <p className="text-white/80 text-xs">Raqib</p>
            <p className="font-bold">{duel.challengedName}</p>
            <p className="text-3xl font-black">{duel.challengedScore}</p>
          </div>
        </div>

        {duel.status !== 'completed' && timeLeft && (
          <div className="mt-3 text-center text-white/80 text-sm">
            ⏱️ {timeLeft}
          </div>
        )}
      </div>

      {duel.status === 'pending' && (() => {
        const myId = getCurrentUserId();
        const isChallenged = myId === duel.challengedId;
        return isChallenged ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-gray-100 space-y-4">
            <p className="text-4xl">⚡</p>
            <p className="font-medium text-gray-700">{duel.challengerName} sizi duelga chaqirdi!</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleRespond(true)}
                className="bg-green-500 text-white px-6 py-2 rounded-xl font-medium"
              >
                ✅ Qabul qilish
              </button>
              <button
                onClick={() => handleRespond(false)}
                className="bg-red-100 text-red-600 px-6 py-2 rounded-xl font-medium"
              >
                ❌ Rad etish
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-gray-100">
            <p className="text-4xl mb-3">⏳</p>
            <p className="font-medium text-gray-700">Raqib qabul qilishini kutmoqdamiz</p>
            <p className="text-sm text-gray-400 mt-1">So&apos;rov yuborildi</p>
          </div>
        );
      })()}

      {duel.status === 'active' && currentQuestion && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">
              Savol {(duel.currentQuestionIdx ?? 0) + 1} / {duel.questions.length}
            </h2>
          </div>
          <p className="text-lg font-semibold text-gray-800">{currentQuestion.text}</p>
          <div className="grid grid-cols-2 gap-2">
            {currentQuestion.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answering}
                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                  selectedAnswer === i
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-indigo-50 hover:border-indigo-300'
                } disabled:opacity-60`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {duel.status === 'completed' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center border border-gray-100 space-y-3">
          <p className="text-4xl">🏆</p>
          <h2 className="text-xl font-bold text-gray-800">Duel yakunlandi!</h2>
          {duel.winner && (
            <p className="text-indigo-600 font-semibold">
              G&apos;olib: {duel.winner}
            </p>
          )}
          <div className="flex justify-center gap-6 mt-2">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-800">{duel.challengerScore}</p>
              <p className="text-xs text-gray-500">{duel.challengerName}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-800">{duel.challengedScore}</p>
              <p className="text-xs text-gray-500">{duel.challengedName}</p>
            </div>
          </div>
          {duel.xpEarned !== undefined && (
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-yellow-700 font-medium">+{duel.xpEarned} XP qo&apos;shildi!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
