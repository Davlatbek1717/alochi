'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Sparkles, FileText, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateNumeric } from '@/lib/date-uz';
import { Modal, Skeleton } from '@/components/ui';

type ConversationTurn = { role: 'ai' | 'student'; text: string; ts: string };

type AiAnalysis = {
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
};

type ExamRow = {
  id: string;
  status: 'active' | 'done' | 'failed';
  score: number | null;
  passed: boolean | null;
  grantedAt: string;
  completedAt: string | null;
  lesson: { id: string; title: string; orderNumber: number } | null;
  exam: {
    id: string;
    title: string;
    kind: 'test' | 'ai_oral';
    passThreshold: number;
  } | null;
  oralSession: {
    id: string;
    status: string;
    score: number | null;
    passed: boolean | null;
    completedAt: string | null;
    aiAnalysis: AiAnalysis | null;
    transcript: ConversationTurn[] | null;
  } | null;
};

interface Props {
  studentId: string;
  /** Title shown above the list; pass false to suppress. */
  title?: string | false;
}

/**
 * Compact exam-history list — completed + active permissions for a student.
 * Used on mentor + filadmin student-detail pages. Each row collapses to a
 * one-line summary; clicking opens a modal with the full AI analysis +
 * transcript when the exam was an ai_oral.
 */
export function StudentExamResults({ studentId, title = 'Imtihon natijalari' }: Props) {
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openRow, setOpenRow] = useState<ExamRow | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ExamRow[]>(`/exams/student/${studentId}`, {}, token)
      .then((res) => setRows(res.data ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Imtihon tarixi yuklanmadi'),
      )
      .finally(() => setLoading(false));
  }, [studentId]);

  const completed = rows.filter((r) => r.status !== 'active');
  const active = rows.filter((r) => r.status === 'active');

  return (
    <>
      <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
        {title !== false && (
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-3">
            {title}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton theme="light" className="h-14 w-full rounded-xl" />
            <Skeleton theme="light" className="h-14 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-rose-800 leading-snug">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#94a3b8] italic">
            Hali imtihon topshirilmagan.
          </p>
        ) : (
          <div className="space-y-2">
            {active.length > 0 && (
              <>
                <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest mt-1">
                  Faol
                </p>
                {active.map((r) => (
                  <ExamRowCard key={r.id} row={r} />
                ))}
              </>
            )}
            {completed.length > 0 && (
              <>
                {active.length > 0 && (
                  <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest mt-3">
                    Tugatilgan
                  </p>
                )}
                {completed.map((r) => (
                  <ExamRowCard
                    key={r.id}
                    row={r}
                    onOpen={r.exam?.kind === 'ai_oral' ? () => setOpenRow(r) : undefined}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <Modal
        open={!!openRow}
        onClose={() => setOpenRow(null)}
        title={openRow?.exam?.title ?? 'Imtihon tafsilotlari'}
        size="lg"
      >
        {openRow && <ExamDetails row={openRow} />}
      </Modal>
    </>
  );
}

function ExamRowCard({ row, onOpen }: { row: ExamRow; onOpen?: () => void }) {
  const title = row.exam?.title ?? row.lesson?.title ?? 'Imtihon';
  const score = row.score ?? row.oralSession?.score ?? null;
  const threshold = row.exam?.passThreshold ?? 70;
  const passed = row.passed ?? row.oralSession?.passed ?? null;
  const completedAt =
    row.completedAt ?? row.oralSession?.completedAt ?? null;

  const isActive = row.status === 'active';

  const body = (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2.5 border',
        isActive
          ? 'bg-amber-50 border-amber-200'
          : passed
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200',
      ].join(' ')}
    >
      <div className="shrink-0">
        {isActive ? (
          <Clock size={18} className="text-amber-600" />
        ) : passed ? (
          <CheckCircle2 size={18} className="text-emerald-600" />
        ) : (
          <XCircle size={18} className="text-rose-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#0f172a] truncate">{title}</p>
        <p className="text-[11px] text-[#64748b] font-semibold">
          {isActive
            ? 'Hozircha topshirilmagan'
            : completedAt
              ? formatDateNumeric(new Date(completedAt))
              : '—'}
          {row.exam?.kind === 'ai_oral' ? ' · AI og‘zaki' : ''}
        </p>
      </div>
      {!isActive && (
        <div className="text-right shrink-0">
          <p
            className={[
              'text-base font-extrabold font-mono',
              passed ? 'text-emerald-700' : 'text-rose-700',
            ].join(' ')}
          >
            {score ?? 0}
          </p>
          <p className="text-[10px] text-[#64748b] font-semibold">
            / {threshold}%
          </p>
        </div>
      )}
    </div>
  );

  if (!onOpen) return body;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left hover:opacity-90 transition-opacity min-h-[44px]"
    >
      {body}
    </button>
  );
}

function ExamDetails({ row }: { row: ExamRow }) {
  const analysis = row.oralSession?.aiAnalysis ?? null;
  const transcript = row.oralSession?.transcript ?? [];
  const score = row.score ?? row.oralSession?.score ?? null;
  const passed = row.passed ?? row.oralSession?.passed ?? null;
  const threshold = row.exam?.passThreshold ?? 70;

  return (
    <div className="space-y-4">
      <div
        className={[
          'rounded-2xl p-4 flex items-center gap-3',
          passed ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200',
        ].join(' ')}
      >
        {passed ? (
          <CheckCircle2 size={28} className="text-emerald-600 shrink-0" />
        ) : (
          <XCircle size={28} className="text-rose-600 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-extrabold text-[#0f172a]">
            {passed ? "O'tdi" : "O'tmadi"}
          </p>
          <p className="text-xs font-semibold text-[#64748b]">
            Ball: <span className="font-mono font-extrabold">{score ?? 0}</span> /{' '}
            {threshold}% kerak
          </p>
        </div>
      </div>

      {analysis && (analysis.strengths?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border-[1.5px] border-emerald-200 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 mb-2">
            Kuchli tomonlari
          </p>
          <ul className="space-y-1 text-sm text-[#0f172a]">
            {analysis.strengths!.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis && (analysis.weaknesses?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border-[1.5px] border-amber-200 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-amber-700 mb-2">
            Yaxshilash uchun
          </p>
          <ul className="space-y-1 text-sm text-[#0f172a]">
            {analysis.weaknesses!.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">!</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis && (analysis.recommendations?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border-[1.5px] border-violet-200 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-violet-700 mb-2">
            Tavsiyalar
          </p>
          <ul className="space-y-1 text-sm text-[#0f172a]">
            {analysis.recommendations!.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <Sparkles size={14} className="text-violet-600 mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {transcript.length > 0 && (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-2 flex items-center gap-1.5">
            <FileText size={12} /> Suhbat
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto -mx-2 px-2">
            {transcript.map((t, i) => (
              <div
                key={i}
                className={[
                  'rounded-xl px-3 py-2 text-sm',
                  t.role === 'student'
                    ? 'bg-[#0d9488]/10 text-[#134e4a] border border-[#0d9488]/20 ml-6'
                    : 'bg-violet-50 text-[#0f172a] border border-violet-100 mr-6',
                ].join(' ')}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-widest mb-0.5 opacity-70">
                  {t.role === 'student' ? "O'quvchi" : 'AI'}
                </p>
                <p className="leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
