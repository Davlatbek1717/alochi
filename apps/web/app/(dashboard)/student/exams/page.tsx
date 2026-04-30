'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Camera, CheckCircle2, XCircle, AlertTriangle, BookOpen } from 'lucide-react';
import { CameraMonitor } from '../lessons/[id]/_components/CameraMonitor';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState } from '@/components/ui';

type McqQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

type ActiveExam = {
  id: string;
  lessonId: string;
  status: string;
  lesson: {
    id: string;
    title: string;
    components_data: { id: string; type: string; config: Record<string, unknown> }[];
  };
};

type ExamResult = {
  passed: boolean;
  score: number;
  correct: number;
  total: number;
};

export default function StudentExamsPage() {
  const router = useRouter();
  const [exam, setExam] = useState<ActiveExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [cameraWarnings, setCameraWarnings] = useState(0);
  const [examAborted, setExamAborted] = useState(false);
  const warningRef = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ActiveExam | null>('/exams/my-active', {}, token)
      .then((res) => {
        setExam(res.data);
        if (res.data) {
          const qs: McqQuestion[] = (res.data.lesson.components_data ?? [])
            .filter((c) => c.type === 'mcq')
            .map((c) => c.config as McqQuestion);
          setQuestions(qs);
          setAnswers(Array(qs.length).fill(null));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLookAway = useCallback(() => {
    warningRef.current += 1;
    setCameraWarnings(warningRef.current);
    if (warningRef.current >= 3) setExamAborted(true);
  }, []);

  async function handleSubmit() {
    if (!exam) return;
    const allAnswered = answers.every((a) => a !== null);
    if (!allAnswered) return;

    setSubmitting(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<ExamResult>(`/exams/${exam.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }, token);
      setResult(res.data);
    } catch {
      // keep result null
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <Skeleton className="h-3 w-20 mb-2 rounded" />
          <Skeleton className="h-6 w-32 rounded" />
        </div>
        <div className="px-4 pt-5 space-y-4">
          <Skeleton theme="light" className="h-32 w-full rounded-[18px]" />
          <Skeleton theme="light" className="h-40 w-full rounded-[18px]" />
          <Skeleton theme="light" className="h-40 w-full rounded-[18px]" />
        </div>
      </div>
    );
  }

  // Result screen
  if (result) {
    const passed = result.passed;
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-8 text-center max-w-sm w-full space-y-5">
          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${
            passed ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
          }`}>
            {passed
              ? <CheckCircle2 size={40} className="text-emerald-500" />
              : <XCircle size={40} className="text-rose-500" />}
          </div>
          <div>
            <p className="text-2xl font-black text-[#0f172a]">{passed ? "O'tdi!" : "O'tmadi"}</p>
            <p className="text-[#64748b] text-sm mt-1">
              {result.total > 0
                ? `${result.correct}/${result.total} to'g'ri — ${result.score}%`
                : 'Imtihon yakunlandi'}
            </p>
          </div>
          {passed ? (
            <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              Tabriklaymiz! Dars to&apos;liq yakunlandi.
            </p>
          ) : (
            <p className="text-rose-700 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              Imtihondan o&apos;tish uchun 70% kerak. Qayta urinish uchun testerga murojaat qiling.
            </p>
          )}
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  // Aborted (camera warning)
  if (examAborted) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-rose-200 p-8 text-center max-w-sm w-full space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} className="text-rose-500" />
          </div>
          <p className="text-xl font-bold text-[#0f172a]">Imtihon bekor qilindi</p>
          <p className="text-[#64748b] text-sm">
            3 marta kameradan uzoqlashganligi sababli imtihon to&apos;xtatildi.
            Qayta urinish uchun testerga murojaat qiling.
          </p>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
            onClick={() => router.push('/student')}
          >
            Bosh sahifaga
          </Button>
        </div>
      </div>
    );
  }

  // No active exam
  if (!exam) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative z-10">
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">O&apos;quvchi</p>
            <p className="text-white text-xl font-bold">Imtihonlar</p>
          </div>
        </div>
        <div className="flex items-center justify-center px-6 pt-20">
          <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] w-full max-w-xs">
            <EmptyState
              theme="light"
              icon={<Lock size={28} />}
              title="Imtihon qulflangan"
              description="Imtihon topshirish uchun akademiyaga keling va testerdan ruxsat oling."
            />
          </div>
        </div>
      </div>
    );
  }

  // Active exam
  const allAnswered = answers.every((a) => a !== null);
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
              <BookOpen size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs">Imtihon</p>
              <p className="text-white font-bold text-base leading-tight">{exam.lesson.title}</p>
            </div>
          </div>
          {cameraWarnings > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-rose-500/20 border border-rose-500/30 rounded-xl px-3 py-2">
              <AlertTriangle size={14} className="text-rose-400" />
              <p className="text-rose-300 text-xs font-semibold">
                Ogohlantirish: {cameraWarnings}/3 — Kameradan uzoqlashmang!
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-4">
        {/* Camera monitor */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={14} className="text-[#0d9488]" />
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Kamera nazorat</p>
          </div>
          <CameraMonitor
            onLookAway={handleLookAway}
            onSilenceTooLong={handleLookAway}
          />
        </div>

        {/* MCQ questions */}
        {questions.length > 0 && (
          <div className="space-y-4">
            {questions.map((q, qi) => (
              <div key={qi} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-widest">
                  Savol {qi + 1}/{questions.length}
                </p>
                <p className="text-[#0f172a] font-semibold text-sm">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = answers[qi] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n; })}
                        className={`w-full text-left px-4 py-3 rounded-xl border-[1.5px] text-sm font-medium transition-all duration-150 flex items-center gap-3 ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-[#ede9e1] bg-[#f7f4ef] text-[#0f172a] hover:border-[#0f172a]/40 hover:bg-white'
                        }`}
                      >
                        <span className="font-mono text-xs opacity-50 shrink-0">{String.fromCharCode(65 + oi)}.</span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {questions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4 text-center">
            <p className="text-amber-700 text-sm font-medium">
              Bu imtihonda savollar yo&apos;q. Testerga murojaat qiling.
            </p>
          </div>
        )}

        {/* Submit */}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={submitting || !allAnswered}
          icon={<CheckCircle2 size={18} />}
          className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl !py-4"
          onClick={handleSubmit}
        >
          {submitting
            ? 'Topshirilmoqda...'
            : allAnswered
              ? 'Imtihonni topshirish'
              : `${answers.filter((a) => a !== null).length}/${questions.length} savol javoblandi`}
        </Button>
      </div>
    </div>
  );
}
