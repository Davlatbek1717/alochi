'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/api';
import { fetchMyBranchId, fetchMyGroupId } from '@/lib/jwt';
import { Skeleton, useToast } from '@/components/ui';

type AnalysisResult = {
  weakAreas: string[];
  recommendation: string;
};

type Student = { id: string; name: string; role: string };

type LatestStatus = {
  englishStatus?: string | null;
  personalStatus?: string | null;
  criticalStatus?: string | null;
} | null;

type ProgressSummary = {
  studentId: string;
  completed: number;
  inProgress: number;
};

const STATUS_LABELS_UZ: Record<string, string> = {
  yashil: 'Yashil',
  sariq: 'Sariq',
  qizil: 'Qizil',
};

function statusChipColor(color: string | null | undefined): string {
  switch (color) {
    case 'yashil':
      return 'bg-[#15803d]/10 text-[#15803d] border border-[#15803d]/20';
    case 'sariq':
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'qizil':
      return 'bg-rose-50 border-rose-200 text-rose-800 border';
    default:
      return 'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]';
  }
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;
  const { success, error: toastError } = useToast();

  const [studentName, setStudentName] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [error, setError] = useState('');
  const [latestStatus, setLatestStatus] = useState<LatestStatus>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);

  // Parent Telegram form
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    // Tahlil / status / progress can fire immediately — they're keyed by
    // studentId and don't need the mentor's group/branch.
    apiRequest<AnalysisResult>(
      `/ai/analyze-errors?studentId=${studentId}`,
      {},
      token,
    )
      .then((res) => setAnalysis(res.data))
      .catch(() => setError("Tahlil ma'lumotlarini yuklab bo'lmadi"))
      .finally(() => setLoadingAnalysis(false));

    apiRequest<LatestStatus>(`/status/${studentId}`, {}, token)
      .then((res) => setLatestStatus(res.data))
      .catch(() => {
        // Status fetch failure is non-fatal
      });

    apiRequest<ProgressSummary>(`/progress/${studentId}/summary`, {}, token)
      .then((res) => setProgressSummary(res.data))
      .catch(() => {
        // Progress fetch failure is non-fatal
      });

    // Roster lookup needs the live group/branch id — JWT may be stale
    // after a recent reassignment, so we hit /users/my-profile first.
    (async () => {
      const [groupId, branchId] = await Promise.all([
        fetchMyGroupId(),
        fetchMyBranchId(),
      ]);
      const rosterPath = groupId
        ? `/users/group/${groupId}`
        : branchId
          ? `/users/by-branch/${branchId}`
          : null;
      if (!rosterPath) return;
      try {
        const res = await apiRequest<Student[]>(rosterPath, {}, token);
        const found = res.data.find((u) => u.id === studentId);
        if (found) setStudentName(found.name);
      } catch {
        // Name fetch failure is non-fatal — page still shows analysis
      }
    })();
  }, [studentId]);

  // Pre-fill the parent message with the AI summary when it lands, but only
  // if the mentor hasn't already started typing.
  useEffect(() => {
    if (!loadingAnalysis && analysis?.recommendation && !message) {
      setMessage(analysis.recommendation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAnalysis, analysis?.recommendation]);

  const sendToParent = useCallback(async () => {
    if (!message.trim() || sending) return;
    if (!studentId) {
      toastError("O'quvchi ID topilmadi");
      return;
    }
    setSending(true);
    setSent(false);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest('/notifications/telegram', {
        method: 'POST',
        body: JSON.stringify({ studentId, message: message.trim() }),
      }, token);
      setSent(true);
      success('Yuborildi');
    } catch (err) {
      const fallback = "Yuborib bo'lmadi";
      const msg =
        err instanceof ApiError
          ? err.code === 'PARENT_TELEGRAM_NOT_LINKED'
            ? "Ota-ona Telegram hisobi ulanmagan"
            : err.message || fallback
          : fallback;
      toastError(msg);
    } finally {
      setSending(false);
    }
  }, [message, sending, studentId, success, toastError]);

  const severityColor = (index: number) => {
    if (index <= 1) return { dot: 'bg-[#e11d48] shadow-[0_0_6px_rgba(225,29,72,0.4)]', bar: 'bg-[#e11d48]' };
    if (index === 2) return { dot: 'bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.4)]', bar: 'bg-[#f59e0b]' };
    return { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]', bar: 'bg-emerald-500' };
  };

  const barWidth = (index: number) => {
    const widths = [80, 60, 40, 20];
    return `${widths[index] ?? Math.max(10, 80 - index * 15)}%`;
  };

  const personalStatus = latestStatus?.personalStatus ?? null;
  const lessonCount = progressSummary?.completed ?? 0;

  return (
    <div className="min-h-full bg-[#f7f4ef]">
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
            {studentName ? (
            <p className="text-white text-lg font-bold">{studentName}</p>
          ) : (
            <Skeleton className="h-5 w-32 bg-white/10" />
          )}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[#94a3b8]">
                o&apos;quvchi
              </span>
              {personalStatus && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusChipColor(personalStatus)}`}
                >
                  {STATUS_LABELS_UZ[personalStatus] ?? personalStatus}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]">
                {lessonCount} ta dars
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

        {/* Parent Telegram message */}
        <div className="mt-2 p-5 rounded-[18px] bg-white border-[1.5px] border-[#ede9e1] shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Send size={14} className="text-[#0d9488]" />
            <h3 className="font-semibold text-[#0f172a] text-sm">
              Ota-onaga xabar yuborish
            </h3>
          </div>
          <p className="text-xs text-[#64748b] mb-3">
            Telegram orqali yuboriladi. AI tahlilini avval to&apos;ldiramiz, kerak
            bo&apos;lsa tahrirlang.
          </p>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (sent) setSent(false);
            }}
            rows={4}
            maxLength={500}
            placeholder="Xabar matni..."
            aria-label="Ota-onaga yuboriladigan xabar"
            className="w-full border border-[#ede9e1] rounded-xl p-3 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 bg-[#f7f4ef]"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-[#94a3b8] font-mono">
              {message.length}/500
            </span>
            <div className="flex items-center gap-3">
              {sent && (
                <span className="text-emerald-600 text-xs font-semibold">
                  Yuborildi ✓
                </span>
              )}
              <button
                onClick={sendToParent}
                disabled={sending || !message.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] disabled:bg-[#94a3b8] disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  'Telegramga yuborish'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
