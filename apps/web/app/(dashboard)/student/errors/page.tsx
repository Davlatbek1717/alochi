'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { Ustoz } from '@/components/Ustoz';

type AnalysisResult = { weakAreas: string[]; recommendation: string };

export default function ErrorAnalysisPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    setError('');
    apiRequest<AnalysisResult>('/ai/analyze-errors', {}, token)
      .then((res) => setAnalysis(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Tahlil yuklanmadi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);

  const severity = (i: number) =>
    i <= 1 ? 'var(--ember)' : i === 2 ? 'var(--gold)' : 'var(--leaf)';

  return (
    <div className="sp-theme min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-2xl">
        <Link
          href="/student"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="sp-eyebrow">AI tomonidan</div>
          <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
            Xato tahlili
          </h1>
        </div>
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-2xl space-y-4">
        {/* Ustoz advice card */}
        <div
          className="flex gap-3 p-4"
          style={{
            background: 'var(--leaf-tint)',
            border: '1.5px solid var(--leaf-soft)',
            borderRadius: 'var(--r-3)',
          }}
        >
          <Ustoz size={70} mood="study" className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="sp-eyebrow" style={{ color: 'var(--leaf-deep)' }}>
              Ustozdan maslahat
            </div>
            {loading ? (
              <div className="space-y-2 mt-2">
                <div className="sp-skeleton h-3.5 w-full" />
                <div className="sp-skeleton h-3.5 w-3/4" />
              </div>
            ) : error ? (
              <>
                <p className="text-sm mt-1.5" style={{ color: 'var(--ember-deep)' }}>
                  {error.toLowerCase().includes('internet') ||
                  error.toLowerCase().includes('network') ||
                  error.toLowerCase().includes('fetch')
                    ? 'Internet aloqasini tekshiring'
                    : error}
                </p>
                <button
                  onClick={load}
                  className="sp-display text-xs mt-2 underline"
                  style={{ color: 'var(--ink-2)' }}
                >
                  Qayta urinish
                </button>
              </>
            ) : analysis?.recommendation ? (
              <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: 'var(--ink-2)' }}>
                {analysis.recommendation}
              </p>
            ) : (
              <p className="text-[13px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                Hali yetarli ma’lumot yo‘q. Darslarni bajarib savollarni javob bering.
              </p>
            )}
            <button
              type="button"
              onClick={() => router.push('/student/lessons')}
              className="sp-display mt-3 inline-flex items-center px-4 py-2 text-xs active:translate-y-[1px] transition-transform"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-2)',
                boxShadow: '0 3px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              Mashqlarni boshlash
            </button>
          </div>
        </div>

        {/* Weak areas */}
        {!loading && !error && analysis && analysis.weakAreas.length > 0 && (
          <div className="space-y-2">
            <p
              className="sp-display text-sm uppercase px-1"
              style={{ letterSpacing: '0.06em', color: 'var(--ink-3)' }}
            >
              Tez-tez qilinadigan xatolar
            </p>
            {analysis.weakAreas.map((topic, i) => (
              <div
                key={topic}
                className="flex items-center gap-3 p-3.5"
                style={{
                  background: 'var(--bone)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-3)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center sp-display shrink-0"
                  style={{
                    background: 'var(--ember-tint)',
                    border: '1.5px solid var(--ember-soft)',
                    color: 'var(--ember-deep)',
                    fontWeight: 800,
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="sp-display text-sm" style={{ color: 'var(--ink)' }}>
                    {topic}
                  </div>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: severity(i) }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && (!analysis || analysis.weakAreas.length === 0) && (
          <div
            className="p-10 text-center"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-4)',
            }}
          >
            <Ustoz size={110} mood="cheer" className="mx-auto" />
            <p className="sp-display mt-3" style={{ color: 'var(--ink)' }}>
              Yaxshi natija!
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
              Kamida 5 ta savolga javob bering va AI tahlil qiladi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
