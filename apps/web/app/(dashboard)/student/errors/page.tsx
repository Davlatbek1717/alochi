'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle, BookOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type AnalysisResult = { weakAreas: string[]; recommendation: string };

export default function ErrorAnalysisPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string };
    const studentId = user.id ?? '';
    if (!studentId) { setLoading(false); return; }

    apiRequest<AnalysisResult>(`/ai/analyze-errors?studentId=${studentId}`, {}, token)
      .then((res) => setAnalysis(res.data))
      .catch(() => setError("Tahlil yuklanmadi"))
      .finally(() => setLoading(false));
  }, []);

  const severityColor = (i: number) => {
    if (i <= 1) return { dot: 'bg-rose-500', bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-600 border-rose-200' };
    if (i === 2) return { dot: 'bg-amber-500', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600 border-amber-200' };
    return { dot: 'bg-emerald-500', bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  };

  const barWidth = (i: number) => {
    const ws = [85, 65, 45, 25];
    return `${ws[i] ?? Math.max(10, 85 - i * 18)}%`;
  };

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <button onClick={() => router.push('/student')} className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-4 relative z-10">
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

      <div className="px-4 pt-5 pb-6 space-y-4">
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
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-sm">{error}</p>
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
        {!loading && analysis && analysis.weakAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Kuchsiz mavzular</p>
            <div className="space-y-2">
              {analysis.weakAreas.map((topic, i) => {
                const c = severityColor(i);
                return (
                  <div key={topic}>
                    <div className="bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 border-[1.5px] border-[#ede9e1]">
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
        {!loading && !error && analysis?.weakAreas.length === 0 && (
          <div className="bg-white rounded-[18px] p-10 text-center border-[1.5px] border-[#ede9e1]">
            <BookOpen size={40} className="text-indigo-300 mx-auto mb-3" />
            <p className="text-[#0f172a] font-semibold">Hali yetarli ma&apos;lumot yo&apos;q</p>
            <p className="text-[#64748b] text-sm mt-1">Kamida 5 ta savolga javob bering.</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push('/student/lessons')}
          className="w-full bg-indigo-600 text-white py-4 rounded-[18px] font-bold text-sm"
        >
          📚 Darslarga o&apos;tish
        </button>
      </div>
    </div>
  );
}
