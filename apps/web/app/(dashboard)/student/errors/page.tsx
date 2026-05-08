'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle, BookOpen, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type AnalysisResult = { weakAreas: string[]; recommendation: string };

export default function ErrorAnalysisPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    // Backend derives studentId from JWT — no localStorage.user lookup needed
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

  const severityColor = (i: number) => {
    if (i <= 1) return {
      dot: 'bg-[#ff4b4b]',
      bar: 'bg-[#ff4b4b]',
      badge: 'bg-[#ff4b4b]/10 text-[#b91c1c] border-[#ff4b4b]/30',
    };
    if (i === 2) return {
      dot: 'bg-[#fbbf24]',
      bar: 'bg-[#fbbf24]',
      badge: 'bg-[#fbbf24]/10 text-[#92400e] border-[#fbbf24]/30',
    };
    return {
      dot: 'bg-[#58cc02]',
      bar: 'bg-[#58cc02]',
      badge: 'bg-[#58cc02]/10 text-[#166534] border-[#58cc02]/30',
    };
  };

  const barWidth = (i: number) => {
    const ws = [85, 65, 45, 25];
    return `${ws[i] ?? Math.max(10, 85 - i * 18)}%`;
  };

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <button
          onClick={() => router.push('/student')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-4 relative z-10 min-h-[44px] hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Bosh sahifaga
        </button>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Tahlil</span>
          </div>
          <p className="text-white text-xl font-bold">Mening Xatolarim</p>
          <p className="text-[#94a3b8] text-xs mt-1">Kuchsiz mavzular va tavsiyalar</p>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-4 max-w-lg mx-auto md:max-w-2xl lg:max-w-3xl md:space-y-5">
        {/* AI Recommendation */}
        <div className="bg-gradient-to-br from-[#1e1b4b] to-[#1e293b] rounded-[18px] p-4 border border-purple-900/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <Sparkles size={13} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Tavsiya</span>
          </div>
          {loading ? (
            <div className="space-y-2 relative z-10">
              <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 relative z-10">
              <AlertTriangle size={14} className="text-[#fbbf24] shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[#fbbf24]/80 text-sm">
                  {error.toLowerCase().includes('internet') || error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')
                    ? 'Internet aloqasini tekshiring'
                    : error}
                </p>
                <button
                  onClick={load}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white transition-colors"
                >
                  <RefreshCw size={11} /> Qayta urinish
                </button>
              </div>
            </div>
          ) : analysis?.recommendation ? (
            <p className="text-white/85 text-sm leading-relaxed relative z-10">{analysis.recommendation}</p>
          ) : (
            <p className="text-[#94a3b8] text-sm relative z-10">
              Hali yetarli ma&apos;lumot yo&apos;q. Darslarni bajarib savollarni javob bering.
            </p>
          )}
        </div>

        {/* Weak areas */}
        {!loading && !error && analysis && analysis.weakAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Kuchsiz mavzular</p>
            <div className="space-y-2">
              {analysis.weakAreas.map((topic, i) => {
                const c = severityColor(i);
                return (
                  <div key={topic}>
                    <div className="bg-white rounded-[14px] px-4 py-3 md:py-4 flex items-center gap-3 border-[1.5px] border-[#ede9e1] md:hover:-translate-y-0.5 md:hover:shadow-md transition-all">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                      <p className="flex-1 text-[#0f172a] text-sm font-semibold">{topic}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                        {i === 0 ? 'Juda kuchsiz' : i === 1 ? 'Kuchsiz' : i === 2 ? "O'rtacha" : 'Yaxshi'}
                      </span>
                    </div>
                    <div className="px-4 -mt-0.5">
                      <div className="h-1 bg-[#ede9e1] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.bar}`} style={{ width: barWidth(i) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && (!analysis || analysis.weakAreas.length === 0) && (
          <div className="bg-white rounded-[18px] p-10 text-center border-[1.5px] border-[#ede9e1]">
            <Mascot expression="happy" size={100} className="mx-auto mb-3" animated />
            <p className="text-[#0f172a] font-extrabold">Yaxshi natija!</p>
            <p className="text-[#64748b] text-sm mt-1">Kamida 5 ta savolga javob bering va AI tahlil qiladi.</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push('/student/lessons')}
          className="w-full bg-[#6d28d9] hover:brightness-105 text-white py-4 rounded-[18px] font-extrabold text-sm border-b-[4px] border-[#4c1d95] active:translate-y-[2px] active:border-b-[2px] transition-all flex items-center justify-center gap-2 min-h-[44px]"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          <BookOpen size={16} /> Darslarga o&apos;tish
        </button>
      </div>
    </div>
  );
}
