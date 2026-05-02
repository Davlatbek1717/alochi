'use client';
import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

export interface ExamQuestion {
  id?: string;
  text: string;
  options: string[];
  correctIndex: number;
  orderIndex?: number;
}

export interface ExamPayload {
  title: string;
  description: string;
  passThreshold: number;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  questions: ExamQuestion[];
}

interface Props {
  /** Exam id when editing; undefined when creating new. */
  examId?: string;
  initial: ExamPayload;
}

/**
 * Shared editor used by both /superadmin/exams/new and
 * /superadmin/exams/[id]. Holds the entire question set in local state
 * and submits the canonical list on save — the server mirrors with a
 * wipe-and-replace transaction so the form doesn't have to track
 * delta operations per row.
 */
export function ExamEditor({ examId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ExamPayload>(initial);
  const [saving, setSaving] = useState(false);

  const fieldLabel =
    'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5';
  const fieldInput =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] transition-colors';

  function patch<K extends keyof ExamPayload>(key: K, value: ExamPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addQuestion() {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          text: '',
          options: ['', '', '', ''],
          correctIndex: 0,
        },
      ],
    }));
  }

  function removeQuestion(idx: number) {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  }

  function updateQuestion(
    idx: number,
    patch: Partial<ExamQuestion>,
  ) {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === idx ? { ...q, ...patch } : q,
      ),
    }));
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((o, j) => (j === optIdx ? value : o)),
            }
          : q,
      ),
    }));
  }

  function moveQuestion(idx: number, direction: -1 | 1) {
    setForm((prev) => {
      const next = [...prev.questions];
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      const t = next[idx];
      next[idx] = next[swapIdx];
      next[swapIdx] = t;
      return { ...prev, questions: next };
    });
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Sarlavha kiriting');
      return;
    }
    if (form.passThreshold < 0 || form.passThreshold > 100) {
      toast.error("O'tish foizi 0 dan 100 gacha bo'lsin");
      return;
    }
    // Validate questions: each must have non-empty text + 2+ non-empty options
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.text.trim()) {
        toast.error(`${i + 1}-savol matnini kiriting`);
        return;
      }
      const filled = q.options.filter((o) => o.trim());
      if (filled.length < 2) {
        toast.error(`${i + 1}-savolda kamida 2 ta javob kerak`);
        return;
      }
      if (q.correctIndex >= q.options.length || !q.options[q.correctIndex]?.trim()) {
        toast.error(`${i + 1}-savolda to'g'ri javob tanlanmagan`);
        return;
      }
    }

    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      passThreshold: form.passThreshold,
      timeLimitMinutes: form.timeLimitMinutes ?? undefined,
      isPublished: form.isPublished,
      questions: form.questions.map((q, i) => ({
        text: q.text.trim(),
        // Strip empty option slots from the trailing end so the server
        // doesn't store ghost entries the editor showed but the user
        // never filled.
        options: q.options.map((o) => o.trim()).filter((o) => o !== ''),
        correctIndex: q.correctIndex,
        orderIndex: i,
      })),
    };

    try {
      if (examId) {
        await apiRequest(
          `/exams/admin/${examId}`,
          { method: 'PATCH', body: JSON.stringify(body) },
          token,
        );
        toast.success('Saqlandi');
      } else {
        const res = await apiRequest<{ id: string }>(
          '/exams/admin',
          { method: 'POST', body: JSON.stringify(body) },
          token,
        );
        toast.success('Imtihon yaratildi');
        // Land on the edit page so the admin can keep iterating.
        router.replace(`/superadmin/exams/${res.data.id}`);
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] pb-28">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          <Link
            href="/superadmin/exams"
            className="flex items-center gap-2 text-[#94a3b8] text-sm hover:text-white transition-colors w-fit"
          >
            <ArrowLeft size={16} /> Imtihonlar
          </Link>
          <p className="text-white text-lg font-extrabold leading-tight">
            {examId ? form.title || 'Imtihon' : 'Yangi imtihon'}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4 max-w-3xl mx-auto">
        {/* Basic fields */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-4">
          <div>
            <label className={fieldLabel}>
              Sarlavha <span className="text-[#e11d48]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                patch('title', e.target.value)
              }
              className={fieldInput}
              placeholder="Masalan: 1-bo'lim — Salomlashish imtihoni"
              autoFocus
            />
          </div>
          <div>
            <label className={fieldLabel}>Tavsif (ixtiyoriy)</label>
            <textarea
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              className={`${fieldInput} min-h-[80px] resize-y`}
              placeholder="Imtihon haqida qisqa ma'lumot — kim uchun, qachon, ..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={fieldLabel}>
                O&apos;tish foizi (0–100) <span className="text-[#e11d48]">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.passThreshold}
                onChange={(e) =>
                  patch(
                    'passThreshold',
                    Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  )
                }
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel}>
                Vaqt cheklovi (daqiqa, ixtiyoriy)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={form.timeLimitMinutes ?? ''}
                onChange={(e) =>
                  patch(
                    'timeLimitMinutes',
                    e.target.value
                      ? Math.max(1, Math.min(180, Number(e.target.value)))
                      : null,
                  )
                }
                className={fieldInput}
                placeholder="Bo'sh — cheklovsiz"
              />
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#f7f4ef] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => patch('isPublished', e.target.checked)}
              className="w-4 h-4 accent-[#0d9488]"
            />
            <span className="text-sm font-bold text-[#0f172a]">
              Nashr qilish
              <span className="ml-2 text-xs text-[#64748b] font-semibold">
                Faollashganda mentor talabalarga ruxsat bera oladi
              </span>
            </span>
          </label>
        </section>

        {/* Questions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Savollar ({form.questions.length})
            </p>
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d9488] bg-white hover:bg-[#0d9488]/5 border border-[#0d9488]/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} /> Yangi savol
            </button>
          </div>

          {form.questions.length === 0 ? (
            <button
              type="button"
              onClick={addQuestion}
              className="w-full border-2 border-dashed border-[#ede9e1] rounded-2xl py-10 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-white transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-[#f7f4ef] flex items-center justify-center">
                <Plus size={20} />
              </div>
              <p className="text-sm font-bold">Birinchi savolni qo&apos;shing</p>
            </button>
          ) : (
            <ul className="space-y-3">
              {form.questions.map((q, qIdx) => (
                <li
                  key={qIdx}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[#94a3b8] cursor-grab" aria-hidden>
                      <GripVertical size={14} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest">
                          Savol #{qIdx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          {qIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveQuestion(qIdx, -1)}
                              aria-label="Yuqoriga"
                              className="text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1 rounded hover:bg-[#f7f4ef]"
                            >
                              ↑
                            </button>
                          )}
                          {qIdx < form.questions.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveQuestion(qIdx, 1)}
                              aria-label="Pastga"
                              className="text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1 rounded hover:bg-[#f7f4ef]"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeQuestion(qIdx)}
                            aria-label="Savolni o'chirish"
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                        placeholder="Savol matni..."
                        className={`${fieldInput} mb-3`}
                      />
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                              aria-pressed={q.correctIndex === optIdx}
                              aria-label={`${optIdx + 1}-javobni to'g'ri deb belgilash`}
                              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                q.correctIndex === optIdx
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-[#ede9e1] hover:border-emerald-300'
                              }`}
                            >
                              {q.correctIndex === optIdx && (
                                <CheckCircle2 size={14} className="text-white" />
                              )}
                            </button>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Javob ${optIdx + 1}`}
                              className={`flex-1 border rounded-xl px-3 py-1.5 text-sm bg-[#f7f4ef] focus:outline-none ${
                                q.correctIndex === optIdx
                                  ? 'border-emerald-300 focus:border-emerald-500 text-[#065f46]'
                                  : 'border-[#ede9e1] focus:border-[#0f172a] text-[#0f172a]'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-[#94a3b8] font-semibold mt-2 inline-flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        Yashil tugmacha — to&apos;g&apos;ri javob
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Validation tip */}
        {form.questions.length === 0 && (
          <div className="bg-amber-50 border-[1.5px] border-amber-200 rounded-2xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800 leading-snug">
              Imtihonni nashr qilish uchun kamida 1 ta savol kerak.
            </p>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#f7f4ef] via-[#f7f4ef] to-transparent pt-4 pb-[env(safe-area-inset-bottom)] px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto pb-2">
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 shadow-lg flex items-center gap-3">
            <Link
              href="/superadmin/exams"
              className="text-xs font-bold text-[#64748b] hover:text-[#0f172a] px-3 py-2 rounded-lg transition-colors"
            >
              Bekor
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 bg-[#0d9488] hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-extrabold px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saving ? 'Saqlanmoqda...' : examId ? 'Saqlash' : 'Yaratish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
