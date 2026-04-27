'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { apiRequest } from '@/lib/api';

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
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bugun takrorlanadigan so&apos;z yo&apos;q!</h2>
        <p className="text-gray-500 text-sm mb-6">Darslarni bajarib so&apos;z boyligingizni oshiring.</p>
        <button onClick={() => router.push('/student')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold">
          Bosh sahifaga
        </button>
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
            <span>{correct}/{items.length}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-3">{pct}%</p>
        </div>
        <button onClick={() => router.push('/student')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold">
          Bosh sahifaga
        </button>
      </div>
    );
  }

  const item = items[current];
  const progress = ((current) / items.length) * 100;

  return (
    <div className="min-h-screen bg-[#f7f4ef] flex flex-col">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/student')} className="text-[#94a3b8] flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Chiqish
          </button>
          <span className="text-[#94a3b8] text-sm font-mono">{current + 1} / {items.length}</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#f59e0b] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full max-w-sm"
        >
          <div className={`bg-white rounded-[24px] shadow-lg border-[1.5px] border-[#ede9e1] p-10 text-center transition-all duration-200 ${flipped ? 'bg-indigo-50 border-indigo-200' : ''}`}>
            {!flipped ? (
              <>
                <p className="text-4xl font-black text-[#0f172a] mb-3">{item.word}</p>
                <p className="text-[#94a3b8] text-sm">Tarjimasini bilsangiz kartani aylantiring</p>
                <div className="mt-4 text-xs text-[#94a3b8] bg-[#f7f4ef] rounded-xl px-3 py-1.5 inline-block">
                  👆 Bosing
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
          <div className="flex gap-4 mt-6 w-full max-w-sm">
            <button
              onClick={() => answer(false)}
              disabled={submitting}
              className="flex-1 bg-rose-50 border-2 border-rose-200 text-rose-600 py-4 rounded-[18px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle size={20} /> Bilmadim
            </button>
            <button
              onClick={() => answer(true)}
              disabled={submitting}
              className="flex-1 bg-emerald-50 border-2 border-emerald-200 text-emerald-600 py-4 rounded-[18px] font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle size={20} /> Bildim
            </button>
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
