'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Trophy, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState } from '@/components/ui';

type ReviewItem = { word: string; easeFactor: number; interval: number };

export default function ReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ReviewItem[]>('/ai/spaced-repetition/daily-review', {}, token)
      .then((res) => setItems(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function answer(isCorrect: boolean) {
    if (submitting) return;
    setSubmitting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest('/ai/spaced-repetition/answer', {
        method: 'POST',
        body: JSON.stringify({ word: items[current].word, correct: isCorrect }),
      }, token);
    } catch {
      // silently continue
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
      <div className="min-h-screen bg-[#f7f4ef]">
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

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] w-full max-w-sm">
          <EmptyState
            theme="light"
            icon={<RefreshCw size={28} />}
            title="Bugun takrorlanadigan so'z yo'q!"
            description="Darslarni bajarib so'z boyligingizni oshiring."
            action={
              <Button
                variant="secondary"
                size="lg"
                className="!bg-indigo-600 hover:!bg-indigo-700 !border-indigo-600 !rounded-2xl"
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
      <div className="min-h-screen bg-[#f7f4ef] flex flex-col items-center justify-center px-6 text-center">
        <Trophy size={56} className="text-amber-500 mb-4" />
        <h2 className="text-2xl font-black text-gray-900 mb-1">Barakalla!</h2>
        <p className="text-gray-500 text-sm mb-6">{items.length} ta so&apos;zdan {correct} tasini bildingiz</p>
        <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex justify-between text-sm font-semibold mb-2">
            <span className="text-emerald-600">To&apos;g&apos;ri</span>
            <span className="text-[#0f172a]">{correct}/{items.length}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-3">{pct}%</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="!bg-indigo-600 hover:!bg-indigo-700 !border-indigo-600 !rounded-2xl !px-8"
          onClick={() => router.push('/student')}
        >
          Bosh sahifaga
        </Button>
      </div>
    );
  }

  const item = items[current];
  const progress = ((current) / items.length) * 100;

  return (
    <div className="min-h-screen bg-[#f7f4ef] flex flex-col">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-6">
        <div className="flex items-center justify-between mb-4 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl">
          <button
            onClick={() => router.push('/student')}
            className="text-[#94a3b8] flex items-center gap-1 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Chiqish
          </button>
          <span className="text-[#94a3b8] text-sm font-mono">{current + 1} / {items.length}</span>
        </div>
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#f59e0b] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full max-w-sm md:max-w-md focus:outline-none"
        >
          <div className={`bg-white rounded-[24px] shadow-lg border-[1.5px] p-10 text-center transition-all duration-200 ${
            flipped ? 'bg-indigo-50 border-indigo-200' : 'border-[#ede9e1]'
          }`}>
            {!flipped ? (
              <>
                <p className="text-4xl font-black text-[#0f172a] mb-3">{item.word}</p>
                <p className="text-[#94a3b8] text-sm">Tarjimasini bilsangiz kartani aylantiring</p>
                <div className="mt-4 text-xs text-[#94a3b8] bg-[#f7f4ef] rounded-xl px-3 py-1.5 inline-block">
                  Bosing
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-indigo-500 uppercase tracking-wider mb-3">Tarjima</p>
                <p className="text-2xl font-bold text-[#0f172a]">{item.word}</p>
                <p className="text-[#94a3b8] text-sm mt-3">Bildingizmi?</p>
              </>
            )}
          </div>
        </button>

        {flipped && (
          <div className="flex gap-4 mt-6 w-full max-w-sm md:max-w-md">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              loading={submitting}
              icon={<XCircle size={18} />}
              className="!bg-rose-50 !border-rose-200 !text-rose-600 hover:!bg-rose-100 !rounded-[18px] !py-4"
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
              className="!bg-emerald-50 !border-emerald-200 !text-emerald-600 hover:!bg-emerald-100 !rounded-[18px] !py-4"
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
