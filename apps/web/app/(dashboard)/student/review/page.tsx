'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { Ustoz } from '@/components/Ustoz';

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

  // ── Loading ──
  if (loading) {
    return (
      <div className="sp-theme min-h-full flex flex-col">
        <div className="px-5 pt-5 pb-6" style={{ background: 'var(--leaf-deep)' }}>
          <div className="sp-skeleton h-4 w-20 mb-4" />
          <div className="sp-skeleton h-1.5 w-full" />
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="sp-skeleton w-full max-w-sm h-72" style={{ borderRadius: 'var(--r-4)' }} />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (loadError) {
    return (
      <div className="sp-theme sp-paper-dots min-h-full flex items-center justify-center p-6">
        <div
          className="text-center max-w-sm w-full space-y-4 p-8"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
          }}
        >
          <Ustoz size={110} mood="oops" className="mx-auto" />
          <p className="sp-display text-base" style={{ color: 'var(--ink)' }}>
            Internet bilan muammo
          </p>
          <p className="sp-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={load}
            className="sp-display inline-flex items-center justify-center px-6 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              border: '2px solid var(--leaf-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--leaf-deep)',
              fontWeight: 700,
            }}
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  // ── Empty ──
  if (items.length === 0) {
    return (
      <div className="sp-theme sp-paper-dots min-h-full flex flex-col items-center justify-center px-6">
        <div
          className="w-full max-w-sm text-center p-8 space-y-4"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-4)',
          }}
        >
          <Ustoz size={120} mood="calm" className="mx-auto" />
          <p className="sp-display text-lg" style={{ color: 'var(--ink)' }}>
            Bugun takrorlanadigan so‘z yo‘q!
          </p>
          <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
            Darslarni bajarib so‘z boyligingizni oshiring.
          </p>
          <button
            type="button"
            onClick={() => router.push('/student')}
            className="sp-display inline-flex items-center justify-center px-6 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              border: '2px solid var(--leaf-deep)',
              borderRadius: 'var(--r-3)',
              boxShadow: '0 4px 0 var(--leaf-deep)',
              fontWeight: 700,
            }}
          >
            Bosh sahifaga
          </button>
        </div>
      </div>
    );
  }

  // ── Done ──
  if (done) {
    const pct = Math.round((correct / items.length) * 100);
    return (
      <div className="sp-theme min-h-full flex flex-col items-center justify-center px-6 text-center">
        <Ustoz size={132} mood="cheer" className="sp-anim-pop" />
        <h2 className="sp-display text-2xl mt-2 mb-1" style={{ color: 'var(--ink)' }}>
          Barakalla!
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-3)' }}>
          {items.length} ta so‘zdan {correct} tasini bildingiz
        </p>
        <div
          className="w-full max-w-xs p-5 mb-6"
          style={{
            background: 'var(--bone)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--r-3)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <div className="flex justify-between text-sm sp-display mb-2">
            <span style={{ color: 'var(--leaf)' }}>To‘g‘ri</span>
            <span style={{ color: 'var(--ink)' }}>
              {correct}/{items.length}
            </span>
          </div>
          <div
            className="h-3 overflow-hidden"
            style={{ background: 'var(--paper-3)', borderRadius: 999 }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, background: 'var(--leaf)', borderRadius: 999 }}
            />
          </div>
          <p className="sp-display text-3xl mt-3" style={{ color: 'var(--ink)' }}>
            {pct}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/student')}
          className="sp-display inline-flex items-center justify-center px-8 py-3 min-h-[44px] active:translate-y-[2px] transition-transform"
          style={{
            background: 'var(--leaf)',
            color: 'var(--bone)',
            border: '2px solid var(--leaf-deep)',
            borderRadius: 'var(--r-3)',
            boxShadow: '0 4px 0 var(--leaf-deep)',
            fontWeight: 700,
          }}
        >
          Bosh sahifaga
        </button>
      </div>
    );
  }

  const item = items[current];
  const progress = (current / items.length) * 100;

  return (
    <div className="sp-theme min-h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-6" style={{ background: 'var(--leaf-deep)' }}>
        <div className="flex items-center justify-between mb-4 max-w-lg mx-auto md:max-w-2xl">
          <button
            onClick={() => router.push('/student')}
            className="flex items-center gap-1 text-sm min-h-[44px]"
            style={{ color: 'var(--leaf-soft)' }}
          >
            <ArrowLeft size={16} /> Chiqish
          </button>
          <span className="sp-mono text-sm" style={{ color: 'var(--leaf-soft)' }}>
            {current + 1} / {items.length}
          </span>
        </div>
        <div
          className="max-w-lg mx-auto md:max-w-2xl h-1.5 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999 }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: 'var(--gold)', borderRadius: 999 }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full max-w-sm md:max-w-lg focus:outline-none"
          aria-label={flipped ? 'Kartani yopish' : 'Kartani aylantirish'}
        >
          <div
            className="p-10 md:p-14 text-center transition-all duration-200"
            style={{
              background: flipped ? 'var(--leaf-tint)' : 'var(--bone-2)',
              border: '2px solid var(--ink)',
              borderRadius: 'var(--r-4)',
              boxShadow: '0 6px 0 var(--ink)',
            }}
          >
            {!flipped ? (
              <>
                <div className="sp-eyebrow mb-3">inglizcha</div>
                <p
                  className="sp-display text-4xl md:text-5xl"
                  style={{ color: 'var(--leaf-deep)' }}
                >
                  {item.word}
                </p>
                <p className="text-sm mt-3" style={{ color: 'var(--ink-3)' }}>
                  Tarjimasini bilsangiz kartani aylantiring
                </p>
                <div
                  className="sp-eyebrow mt-5 inline-block px-3 py-1.5"
                  style={{ background: 'var(--paper-2)', borderRadius: 999 }}
                >
                  ⤺ bos
                </div>
              </>
            ) : (
              <>
                <div className="sp-eyebrow mb-3">savol</div>
                <p className="sp-display text-2xl" style={{ color: 'var(--ink)' }}>
                  {item.word}
                </p>
                <p className="text-sm mt-3" style={{ color: 'var(--ink-3)' }}>
                  Bu so‘zni bildingizmi?
                </p>
              </>
            )}
          </div>
        </button>

        {flipped && (
          <div className="flex gap-3 mt-6 w-full max-w-sm md:max-w-lg">
            <button
              type="button"
              disabled={submitting}
              onClick={() => answer(false)}
              className="sp-display flex-1 py-4 min-h-[44px] active:translate-y-[2px] transition-transform disabled:opacity-60"
              style={{
                background: 'var(--ember)',
                color: 'var(--bone)',
                border: '2px solid var(--ember-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--ember-deep)',
                fontWeight: 700,
              }}
            >
              Bilmadim
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => answer(true)}
              className="sp-display flex-1 py-4 min-h-[44px] active:translate-y-[2px] transition-transform disabled:opacity-60"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              Bildim
            </button>
          </div>
        )}

        {!flipped && (
          <p className="sp-mono text-xs mt-6" style={{ color: 'var(--ink-4)' }}>
            Interval: {item.interval} kun · EF: {item.easeFactor.toFixed(1)}
          </p>
        )}
      </div>
    </div>
  );
}
