'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type AnalysisResult = {
  weakAreas: string[];
  recommendation: string;
};

type Student = { id: string; name: string; role: string };

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [studentName, setStudentName] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();

    const fetchStudentName = branchId
      ? apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token)
          .then((res) => {
            const found = res.data.find((u) => u.id === studentId);
            if (found) setStudentName(found.name);
          })
          .catch(() => {})
      : Promise.resolve();

    const fetchAnalysis = apiRequest<AnalysisResult>(
      `/ai/analyze-errors?studentId=${studentId}`,
      {},
      token,
    )
      .then((res) => setAnalysis(res.data))
      .catch(() => setError("Tahlil ma'lumotlarini yuklab bo'lmadi"))
      .finally(() => setLoadingAnalysis(false));

    Promise.all([fetchStudentName, fetchAnalysis]);
  }, [studentId]);

  const severityColor = (index: number) => {
    if (index <= 1) return { dot: 'bg-[#e11d48] shadow-[0_0_6px_rgba(225,29,72,0.4)]', bar: 'bg-[#e11d48]' };
    if (index === 2) return { dot: 'bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.4)]', bar: 'bg-[#f59e0b]' };
    return { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]', bar: 'bg-emerald-500' };
  };

  const barWidth = (index: number) => {
    const widths = [80, 60, 40, 20];
    return `${widths[index] ?? Math.max(10, 80 - index * 15)}%`;
  };

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-44 h-44 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }}
        />
        <button
          onClick={() => router.push('/mentor/group')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-5 relative z-10"
        >
          <ArrowLeft size={16} />
          Guruhga qaytish
        </button>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shrink-0">
            {studentName ? getInitials(studentName) : '?'}
          </div>
          <div>
            <p className="text-white text-lg font-bold">{studentName || 'Yuklanmoqda...'}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[#94a3b8]">
                o&apos;quvchi
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* AI Analysis Card */}
        <div className="bg-gradient-to-br from-[#1e1b4b] to-[#1e293b] rounded-[18px] p-4 border border-purple-900/30 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">AI Tahlil</span>
          </div>

          {loadingAnalysis ? (
            <div className="space-y-2 relative z-10">
              <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/10 rounded animate-pulse w-4/5" />
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
              Hali yetarli ma&apos;lumot yo&apos;q (kamida 5 ta xato kerak).
            </p>
          )}
        </div>

        {/* Weak Areas */}
        {!loadingAnalysis && analysis && analysis.weakAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Kuchsiz mavzular</p>
            <div className="space-y-2">
              {analysis.weakAreas.map((topic, index) => {
                const colors = severityColor(index);
                return (
                  <div key={topic}>
                    <div className="bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 border-[1.5px] border-[#ede9e1]">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                      <p className="flex-1 text-[#0f172a] text-sm font-semibold">{topic}</p>
                      <span className="text-xs font-mono font-semibold text-[#64748b] bg-[#f7f4ef] px-2 py-0.5 rounded-full">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="px-4 -mt-1">
                      <div className="h-1 bg-[#ede9e1] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors.bar}`} style={{ width: barWidth(index) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No data state */}
        {!loadingAnalysis && !error && analysis?.weakAreas.length === 0 && (
          <div className="bg-white rounded-[18px] p-8 text-center border-[1.5px] border-[#ede9e1]">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-[#0f172a] font-semibold">Hali yetarli ma&apos;lumot yo&apos;q</p>
            <p className="text-[#64748b] text-sm mt-1">
              O&apos;quvchi kamida 5 ta savol javob berganda tahlil paydo bo&apos;ladi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
