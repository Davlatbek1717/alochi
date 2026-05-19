'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import Link from 'next/link';
import { Ustoz } from '@/components/Ustoz';

type DuelQuestion = { text: string; options: string[] };

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
  winnerId?: string | null;
  winner?: string | null;
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
  const toast = useToast();

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
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duel topilmadi');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDuel();
  }, [fetchDuel]);

  useFocusRevalidate(fetchDuel);
  useRevalidateOnEvent(['status:updated'], fetchDuel);

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
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
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
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setResponding(false);
    }
  }

  if (loading) {
    return (
      <div className="sp-theme min-h-full p-4 space-y-4">
        <div className="sp-skeleton h-6 w-40" />
        <div className="sp-skeleton h-16 w-full" style={{ borderRadius: 'var(--r-3)' }} />
        <div className="sp-skeleton h-64 w-full" style={{ borderRadius: 'var(--r-3)' }} />
      </div>
    );
  }

  if (error || !duel) {
    return (
      <div className="sp-theme sp-paper-dots min-h-full flex items-center justify-center p-4">
        <div
          className="text-center max-w-sm w-full space-y-4 p-8"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
          }}
        >
          <Ustoz size={96} mood="oops" className="mx-auto" />
          <p className="sp-display text-base" style={{ color: 'var(--ink)' }}>
            {error || 'Duel topilmadi'}
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Duel mavjud emas yoki sizga tegishli emas.
          </p>
          <Link
            href="/student/duels"
            className="sp-display inline-flex items-center gap-2 px-5 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              border: '2px solid var(--leaf-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--leaf-deep)',
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={14} /> Duellar roʻyxati
          </Link>
        </div>
      </div>
    );
  }

  const currentQuestion =
    duel.status === 'active' && duel.questions
      ? duel.questions[duel.currentQuestionIdx]
      : null;
  const total = Math.max(1, duel.challengerScore + duel.challengedScore);
  const isChallenged = currentUserId === duel.challengedId;

  return (
    <div
      className="sp-theme min-h-full pb-10"
      style={{
        background:
          duel.status === 'completed'
            ? 'var(--paper)'
            : 'linear-gradient(180deg, var(--paper) 0%, var(--ember-tint) 100%)',
      }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-2xl">
        <Link
          href="/student/duels"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="sp-eyebrow">
            duel · vs {currentUserId === duel.challengerId ? duel.challengedName : duel.challengerName}
          </div>
          <h1 className="sp-display text-lg leading-tight" style={{ color: 'var(--ink)' }}>
            {duel.status === 'active'
              ? `Savol ${(duel.currentQuestionIdx ?? 0) + 1} / ${duel.questions?.length ?? 10}`
              : duel.status === 'pending'
                ? 'Duel taklifi'
                : 'Duel yakuni'}
          </h1>
        </div>
        {duel.status !== 'completed' && timeLeft && (
          <span
            className="sp-mono text-xs px-3 py-1.5 shrink-0"
            style={{ background: 'var(--ink)', color: 'var(--bone)', borderRadius: 999, fontWeight: 700 }}
          >
            ⏱ {timeLeft}
          </span>
        )}
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-2xl space-y-4">
        {/* Battle bar */}
        <div
          className="flex items-center gap-2.5 p-3"
          style={{
            background: 'var(--bone-2)',
            border: '2px solid var(--ink)',
            borderRadius: 'var(--r-3)',
          }}
        >
          <DuelAvatar name={duel.challengerName} color="var(--leaf)" />
          <div
            className="flex-1 relative h-[18px] overflow-hidden flex"
            style={{ background: 'var(--paper-3)', borderRadius: 999 }}
          >
            <div
              style={{
                background: 'var(--leaf)',
                height: '100%',
                width: `${(duel.challengerScore / total) * 100}%`,
              }}
            />
            <span
              className="absolute left-2 top-1/2 -translate-y-1/2 sp-mono"
              style={{ color: 'var(--bone)', fontWeight: 700, fontSize: 11 }}
            >
              {duel.challengerScore}
            </span>
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 sp-mono"
              style={{ color: 'var(--ember-deep)', fontWeight: 700, fontSize: 11 }}
            >
              {duel.challengedScore}
            </span>
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sp-display"
              style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 12 }}
            >
              VS
            </span>
          </div>
          <DuelAvatar name={duel.challengedName} color="var(--ember)" />
        </div>

        {/* Pending — invitation */}
        {duel.status === 'pending' &&
          (isChallenged ? (
            <div
              className="p-6 text-center space-y-4"
              style={{
                background: 'var(--bone)',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-3)',
              }}
            >
              <Ustoz size={96} mood="study" className="mx-auto" />
              <p className="sp-display" style={{ color: 'var(--ink)' }}>
                {duel.challengerName} sizni duelga chaqirdi!
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleRespond(true)}
                  disabled={responding}
                  className="sp-display px-6 py-3 min-h-[44px] active:translate-y-[2px] transition-transform disabled:opacity-50"
                  style={{
                    background: 'var(--leaf)',
                    color: 'var(--bone)',
                    border: '2px solid var(--leaf-deep)',
                    borderRadius: 'var(--r-3)',
                    boxShadow: '0 4px 0 var(--leaf-deep)',
                    fontWeight: 700,
                  }}
                >
                  Qabul qilish
                </button>
                <button
                  onClick={() => handleRespond(false)}
                  disabled={responding}
                  className="sp-display px-6 py-3 min-h-[44px] disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--ember-deep)',
                    border: '1.5px solid var(--ember-soft)',
                    borderRadius: 'var(--r-3)',
                    fontWeight: 700,
                  }}
                >
                  Rad etish
                </button>
              </div>
            </div>
          ) : (
            <div
              className="p-6 text-center space-y-2"
              style={{
                background: 'var(--bone)',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-3)',
              }}
            >
              <Ustoz size={88} mood="calm" className="mx-auto" />
              <p className="sp-display" style={{ color: 'var(--ink)' }}>
                Raqib qabul qilishini kutmoqdamiz
              </p>
              <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                Soʻrov yuborildi
              </p>
            </div>
          ))}

        {/* Active — question */}
        {duel.status === 'active' && currentQuestion && (
          <div
            className="p-5 space-y-4"
            style={{
              background: 'var(--bone-2)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <div className="sp-eyebrow">Savolga javob bering</div>
            <h2 className="sp-display text-xl m-0" style={{ color: 'var(--ink)' }}>
              {currentQuestion.text}
            </h2>
            <div className="flex flex-col gap-2.5">
              {currentQuestion.options.map((opt, i) => {
                const active = selectedAnswer === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={answering}
                    className="flex items-center gap-3 p-3.5 text-left min-h-[44px] active:translate-y-[1px] transition-transform disabled:opacity-60"
                    style={{
                      background: active ? 'var(--ink)' : 'var(--bone)',
                      color: active ? 'var(--bone)' : 'var(--ink)',
                      border: `1.5px solid ${active ? 'var(--ink)' : 'var(--line-2)'}`,
                      borderRadius: 'var(--r-2)',
                    }}
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center sp-mono shrink-0"
                      style={{
                        background: active ? 'rgba(255,255,255,0.16)' : 'var(--paper-2)',
                        fontSize: 12,
                      }}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1 text-sm">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active — waiting for opponent */}
        {duel.status === 'active' && !currentQuestion && (
          <div
            className="p-6 text-center space-y-3"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <Ustoz size={88} mood="calm" className="mx-auto" />
            <p className="sp-display" style={{ color: 'var(--ink)' }}>
              Raqibingizning javobini kutmoqdamiz
            </p>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              Savollar tez orada yangilanadi
            </p>
          </div>
        )}

        {/* Completed */}
        {duel.status === 'completed' && (
          <div
            className="p-6 text-center space-y-4"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <Ustoz
              size={120}
              mood={duel.winnerId === currentUserId ? 'cheer' : 'calm'}
              className="mx-auto sp-anim-pop"
            />
            <h2 className="sp-display text-xl" style={{ color: 'var(--ink)' }}>
              Duel yakunlandi!
            </h2>
            {duel.winnerId && (
              <p
                className="sp-display"
                style={{
                  color: duel.winnerId === currentUserId ? 'var(--leaf)' : 'var(--ink-3)',
                }}
              >
                {duel.winnerId === currentUserId
                  ? "🏆 Siz g'olib bo'ldingiz!"
                  : `G'olib: ${duel.winner ?? (duel.winnerId === duel.challengerId ? duel.challengerName : duel.challengedName)}`}
              </p>
            )}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <p className="sp-display text-3xl" style={{ color: 'var(--leaf-deep)' }}>
                  {duel.challengerScore}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  {duel.challengerName}
                </p>
              </div>
              <div className="text-center">
                <p className="sp-display text-3xl" style={{ color: 'var(--ember-deep)' }}>
                  {duel.challengedScore}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  {duel.challengedName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/student/duels')}
              className="sp-display inline-flex items-center justify-center px-5 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              Duellar roʻyxati
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DuelAvatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center sp-display shrink-0"
      style={{
        background: color,
        color: 'var(--bone)',
        border: '2px solid var(--ink)',
        fontWeight: 800,
      }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}
