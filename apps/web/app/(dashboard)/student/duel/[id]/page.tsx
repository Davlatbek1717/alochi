'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Sword, Clock, Trophy, CheckCircle, XCircle, Zap, Timer } from 'lucide-react';
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
  const [responding, setResponding] = useState(false);

  const currentUserId = useMemo(() => getCurrentUserId(), []);

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
    if (!duel || responding) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setResponding(true);
    try {
      await apiRequest(`/social/duels/${id}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ accept }),
      }, token);
      await fetchDuel();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <p className="text-[#64748b]">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !duel) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-4">
        <p className="text-[#e11d48]">{error || 'Duel topilmadi'}</p>
      </div>
    );
  }

  const currentQuestion = duel.status === 'active' && duel.questions
    ? duel.questions[duel.currentQuestionIdx]
    : null;

  const statusBadge = {
    pending: { label: 'Kutilmoqda', cls: 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30' },
    active: { label: 'Faol', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    completed: { label: 'Tugagan', cls: 'bg-white/10 text-white/60 border-white/10' },
  }[duel.status];

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Hero header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(225,29,72,0.15) 0%, transparent 60%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(245,158,11,0.15) 0%, transparent 60%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sword size={20} className="text-[#e11d48]" />
              <p className="text-white font-bold text-lg">Duel</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${statusBadge.cls}`}>
              {statusBadge.label}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wide mb-1">Musobaqa</p>
              <p className="text-white font-bold text-sm">{duel.challengerName}</p>
              <p className="text-5xl font-black text-[#e11d48] font-mono mt-1">{duel.challengerScore}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-white/30 text-2xl font-black">VS</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-[#94a3b8] text-xs uppercase tracking-wide mb-1">Raqib</p>
              <p className="text-white font-bold text-sm">{duel.challengedName}</p>
              <p className="text-5xl font-black text-[#f59e0b] font-mono mt-1">{duel.challengedScore}</p>
            </div>
          </div>

          {duel.status !== 'completed' && timeLeft && (
            <div className="flex items-center justify-center gap-2 mt-4 text-[#94a3b8] text-sm">
              <Timer size={14} />
              <span className="font-mono">{timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Pending: invitation response */}
        {duel.status === 'pending' && (() => {
          const isChallenged = currentUserId === duel.challengedId;
          return isChallenged ? (
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#f59e0b]/10 border-2 border-[#f59e0b]/30 flex items-center justify-center mx-auto">
                <Zap size={28} className="text-[#f59e0b]" />
              </div>
              <p className="font-semibold text-[#0f172a]">{duel.challengerName} sizi duelga chaqirdi!</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleRespond(true)}
                  disabled={responding}
                  className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                >
                  <CheckCircle size={16} /> Qabul qilish
                </button>
                <button
                  onClick={() => handleRespond(false)}
                  disabled={responding}
                  className="flex items-center gap-2 bg-[#f7f4ef] text-[#e11d48] border-[1.5px] border-[#e11d48]/30 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-[#e11d48]/10 transition-colors"
                >
                  <XCircle size={16} /> Rad etish
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
              <Clock size={32} className="text-[#94a3b8] mx-auto mb-3" />
              <p className="font-semibold text-[#0f172a]">Raqib qabul qilishini kutmoqdamiz</p>
              <p className="text-sm text-[#94a3b8] mt-1">So&apos;rov yuborildi</p>
            </div>
          );
        })()}

        {/* Active: question */}
        {duel.status === 'active' && currentQuestion && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                Savol {(duel.currentQuestionIdx ?? 0) + 1} / {duel.questions.length}
              </p>
              <div className="flex gap-1">
                {duel.questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full ${i < duel.currentQuestionIdx ? 'bg-emerald-400' : i === duel.currentQuestionIdx ? 'bg-[#e11d48]' : 'bg-[#ede9e1]'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-lg font-bold text-[#0f172a]">{currentQuestion.text}</p>
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answering}
                  className={`py-3 px-4 rounded-xl border-[1.5px] text-sm font-semibold transition-all ${
                    selectedAnswer === i
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-[#f7f4ef] text-[#0f172a] border-[#ede9e1] hover:border-[#0f172a]'
                  } disabled:opacity-60`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {duel.status === 'completed' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#f59e0b]/10 border-2 border-[#f59e0b]/30 flex items-center justify-center mx-auto">
              <Trophy size={28} className="text-[#f59e0b]" />
            </div>
            <h2 className="text-xl font-bold text-[#0f172a]">Duel yakunlandi!</h2>
            {duel.winner && (
              <p className="text-[#0d9488] font-bold">
                G&apos;olib: {duel.winner}
              </p>
            )}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-black text-[#e11d48] font-mono">{duel.challengerScore}</p>
                <p className="text-xs text-[#64748b] mt-1">{duel.challengerName}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-[#f59e0b] font-mono">{duel.challengedScore}</p>
                <p className="text-xs text-[#64748b] mt-1">{duel.challengedName}</p>
              </div>
            </div>
            {duel.xpEarned !== undefined && (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-3">
                <p className="text-[#f59e0b] font-bold">+{duel.xpEarned} XP qo&apos;shildi!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
