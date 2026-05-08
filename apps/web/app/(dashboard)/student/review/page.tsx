'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Trophy, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type ReviewItem = { word: string; easeFactor: number; interval: number };

export default function ReviewPage() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    setLoadError('');
    apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token)
      .then((res) => setItems(res.data ?? []))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Yuklanmadi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);

  async function answer(isCorrect: boolean) {
    if (submitting) return;
    setSubmitting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest('/ai/spaced-repetition/answer', {
        method: 'POST',
        body: JSON.stringify({ word: items[current].word, correct: isCorrect }),
      }, token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Javob saqlanmadi');
    }
    if (isCorrect) setCorrect((c) => c + 1);
    if (current + 1 >= items.length) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
      setFlipped(false);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-6">
          <Skeleton className="h-4 w-20 mb-4 rounded" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
          <Skeleton className="w-full max-w-sm h-48 rounded-[24px]" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-rose-200 p-8 text-center max-w-sm w-full space-y-4">
          <p className="text-5xl" aria-hidden>📡</p>
          <p className="text-[#0f172a] font-extrabold text-base">Yuklab bo&apos;lmadi</p>
          <p className="text-[#64748b] text-sm">{loadError}</p>
          <p className="text-[#94a3b8] text-xs">Internet aloqasini tekshiring</p>
          <Button
            variant="duo"
            size="lg"
            fullWidth
            onClick={load}
          >
            Qayta urinish
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] w-full max-w-sm">
          <EmptyState
            theme="light"
            icon={<RefreshCw size={28} />}
            title="Bugun takrorlanadigan so'z yo'q!"
            description="Darslarni bajarib so'z boyligingizni oshiring."
            action={
              <Button
                variant="duo"
                size="lg"
                onClick={() => router.push('/student')}
              >
                Bosh sahifaga
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correct / items.length) * 100);
    return (
      <div className="min-h-full bg-[#f7f4ef] flex flex-col items-center justify-center px-6 text-center">
        <Trophy size={56} className="text-[#fbbf24] mb-4" />
        <h2 className="text-2xl font-black text-[#0f172a] mb-1" style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}>
          Barakalla!
        </h2>
        <p className="text-[#64748b] text-sm mb-6">{items.length} ta so&apos;zdan {correct} tasini bildingiz</p>
        <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-sm border-[1.5px] border-[#ede9e1] mb-6">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-[#58cc02]">To&apos;g&apos;ri</span>
            <span className="text-[#0f172a]">{correct}/{items.length}</span>
          </div>
          <div className="h-3 bg-[#f3eedf] rounded-full overflow-hidden">
            <div className="h-full bg-[#58cc02] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-3xl font-black text-[#0f172a] mt-3">{pct}%</p>
        </div>
        <Button
          variant="duo"
          size="lg"
          className="!px-8"
          onClick={() => router.push('/student')}
        >
          Bosh sahifaga
        </Button>
      </div>
    );
  }

  const item = items[current];
  const progress = (current / items.length) * 100;

  return (
    <div className="min-h-full bg-[#f7f4ef] flex flex-col">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-6">
        <div className="flex items-center justify-between mb-4 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl">
          <button
            onClick={() => router.push('/student')}
            className="text-[#94a3b8] flex items-center gap-1 text-sm hover:text-white transition-colors min-h-[44px]"
          >
            <ArrowLeft size={16} /> Chiqish
          </button>
          <span className="text-[#94a3b8] text-sm font-mono">{current + 1} / {items.length}</span>
        </div>
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#fbbf24] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full max-w-sm md:max-w-lg focus:outline-none focus:ring-2 focus:ring-[#58cc02] focus:ring-offset-2 rounded-[24px]"
          aria-label={flipped ? 'Kartani yopish' : 'Kartani aylantirish'}
        >
          <div className={`bg-white rounded-[24px] shadow-lg border-[1.5px] p-10 md:p-14 text-center transition-all duration-200 ${
            flipped ? 'bg-[#ede9fe] border-[#a78bfa]' : 'border-[#ede9e1]'
          }`}>
            {!flipped ? (
              <>
                <p className="text-4xl md:text-5xl lg:text-6xl font-black text-[#0f172a] mb-3">{item.word}</p>
                <p className="text-[#94a3b8] text-sm md:text-base">Tarjimasini bilsangiz kartani aylantiring</p>
                <div className="mt-4 text-xs text-[#94a3b8] bg-[#f7f4ef] rounded-xl px-3 py-1.5 inline-block">
                  Bosing
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#6d28d9] uppercase tracking-wider mb-3">Tarjima</p>
                <p className="text-2xl font-bold text-[#0f172a]">{item.word}</p>
                <p className="text-[#94a3b8] text-sm mt-3">Bildingizmi?</p>
              </>
            )}
          </div>
        </button>

        {flipped && (
          <div className="flex gap-4 mt-6 w-full max-w-sm md:max-w-lg">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              loading={submitting}
              icon={<XCircle size={18} />}
              className="!bg-[#ff4b4b]/10 !border-[#ff4b4b]/30 !text-[#ff4b4b] hover:!bg-[#ff4b4b]/20 !rounded-[18px] !py-4 border-b-[3px]"
              onClick={() => answer(false)}
            >
              Bilmadim
            </Button>
            <Button
              variant="success"
              size="lg"
              fullWidth
              loading={submitting}
              icon={<CheckCircle size={18} />}
              className="!bg-[#58cc02]/10 !border-[#58cc02]/30 !text-[#58cc02] hover:!bg-[#58cc02]/20 !rounded-[18px] !py-4 border-b-[3px]"
              onClick={() => answer(true)}
            >
              Bildim
            </Button>
          </div>
        )}

        {!flipped && (
          <p className="text-[#94a3b8] text-xs mt-6">
            Interval: {item.interval} kun · EF: {item.easeFactor.toFixed(1)}
          </p>
        )}
      </div>
    </div>
  );
}
