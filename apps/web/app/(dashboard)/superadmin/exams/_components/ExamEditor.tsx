'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { useToast, Modal } from '@/components/ui';
import {
  COMPONENT_LABELS,
  COMPONENT_BADGE_STYLES,
  COMPONENT_ICONS,
  summarizeConfig,
} from '../../lessons/[id]/_components/ComponentsList';
import {
  ComponentConfigurator,
  ALL_TYPES,
  type ComponentTypeKey,
} from '../../lessons/[id]/_components/ComponentConfigurator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExamQuestion {
  id?: string;
  type: string;
  config: Record<string, unknown>;
  orderIndex: number;
}

export interface ExamPayload {
  title: string;
  description: string;
  /** "test" — classic 12-exercise question runner (default).
   *  "ai_oral" — AI-driven oral conversation exam (Gemini). */
  kind: 'test' | 'ai_oral';
  /** Required for ai_oral. Ignored for test. */
  language: 'uz' | 'en';
  /** AI instructions for the conversation (what to ask, how to grade). */
  aiPrompt: string;
  /** Soft cap on conversation length, ai_oral only. */
  maxMinutes: number;
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

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Shared editor used by both /superadmin/exams/new and
 * /superadmin/exams/[id]. Holds the full question set in local state and
 * submits the canonical list on save — the server mirrors with a
 * wipe-and-replace transaction. Uses the same type-picker + configurator
 * pattern as the lesson editor so all 12 exercise types are supported.
 */
export function ExamEditor({ examId, initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<ExamPayload>(initial);
  const [saving, setSaving] = useState(false);

  // Picker + configurator state (mirrors lesson editor pattern exactly)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configType, setConfigType] = useState<ComponentTypeKey | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fieldLabel =
    'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5';
  const fieldInput =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] transition-colors';

  function patch<K extends keyof ExamPayload>(key: K, value: ExamPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Picker / configurator handlers ────────────────────────────────────────

  function openTypePicker() {
    setEditingIdx(null);
    setConfigType(null);
    setPickerOpen(true);
  }

  function pickType(type: ComponentTypeKey) {
    setPickerOpen(false);
    setEditingIdx(null);
    setConfigType(type);
  }

  function openEdit(idx: number) {
    const q = form.questions[idx];
    setEditingIdx(idx);
    setConfigType(q.type as ComponentTypeKey);
  }

  function closeConfigurator() {
    setConfigType(null);
    setEditingIdx(null);
    setSavingConfig(false);
  }

  function handleConfigSubmit(config: Record<string, unknown>) {
    if (!configType) return;
    setSavingConfig(true);
    setForm((prev) => {
      if (editingIdx !== null) {
        // Edit existing question
        const updated = prev.questions.map((q, i) =>
          i === editingIdx ? { ...q, config } : q,
        );
        return { ...prev, questions: updated };
      } else {
        // Add new question
        const newQ: ExamQuestion = {
          type: configType,
          config,
          orderIndex: prev.questions.length,
        };
        return { ...prev, questions: [...prev.questions, newQ] };
      }
    });
    setSavingConfig(false);
    toast.success(editingIdx !== null ? 'Savol yangilandi' : "Savol qo'shildi");
    closeConfigurator();
  }

  function removeQuestion(idx: number) {
    if (!window.confirm('Bu savolni oʻchirmoqchimisiz?')) return;
    setForm((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, orderIndex: i })),
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
      return {
        ...prev,
        questions: next.map((q, i) => ({ ...q, orderIndex: i })),
      };
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Sarlavha kiriting');
      return;
    }
    if (form.passThreshold < 0 || form.passThreshold > 100) {
      toast.error("O'tish foizi 0 dan 100 gacha bo'lsin");
      return;
    }
    if (form.kind === 'ai_oral' && !form.aiPrompt.trim()) {
      toast.error("AI imtihon uchun yo'l-yo'riq matnini kiriting");
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      kind: form.kind,
      // Only send ai-only fields when kind=ai_oral so the server can
      // null them out when the admin switches a test exam to oral.
      ...(form.kind === 'ai_oral'
        ? {
            language: form.language,
            aiPrompt: form.aiPrompt.trim(),
            maxMinutes: form.maxMinutes,
          }
        : {}),
      passThreshold: form.passThreshold,
      timeLimitMinutes: form.timeLimitMinutes ?? undefined,
      isPublished: form.isPublished,
      questions:
        form.kind === 'ai_oral'
          ? []
          : form.questions.map((q, i) => ({
              ...(q.id ? { id: q.id } : {}),
              type: q.type,
              config: q.config,
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
        router.replace(`/superadmin/exams/${res.data.id}`);
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Saqlashda xato');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const editingQuestion =
    editingIdx !== null ? form.questions[editingIdx] : null;

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
              onChange={(e) => patch('title', e.target.value)}
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

        {/* Imtihon turi tanlovi — Test (klassik) yoki AI og'zaki */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-4">
          <p className={fieldLabel}>Imtihon turi</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => patch('kind', 'test')}
              className={`text-left rounded-xl border-[1.5px] p-4 transition-colors ${
                form.kind === 'test'
                  ? 'border-[#0d9488] bg-[#0d9488]/5'
                  : 'border-[#ede9e1] hover:border-[#0d9488]/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📝</span>
                <span className="font-extrabold text-sm text-[#0f172a]">Test</span>
              </div>
              <p className="text-[11px] font-semibold text-[#64748b] leading-snug">
                12 turdagi topshiriqlardan tuzilgan klassik imtihon
                (MCQ, so&apos;z tartibi, tarjima va h.k.)
              </p>
            </button>
            <button
              type="button"
              onClick={() => patch('kind', 'ai_oral')}
              className={`text-left rounded-xl border-[1.5px] p-4 transition-colors ${
                form.kind === 'ai_oral'
                  ? 'border-[#7c3aed] bg-[#7c3aed]/5'
                  : 'border-[#ede9e1] hover:border-[#7c3aed]/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🎙️</span>
                <span className="font-extrabold text-sm text-[#0f172a]">
                  AI og&apos;zaki
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#64748b] leading-snug">
                AI o&apos;quvchi bilan og&apos;zaki suhbat o&apos;tkazadi va
                javoblarini tahlil qilib ball beradi.
              </p>
            </button>
          </div>

          {/* AI og'zaki sozlamalari */}
          {form.kind === 'ai_oral' && (
            <div className="space-y-4 pt-2 border-t border-[#ede9e1]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={fieldLabel}>
                    Til <span className="text-[#e11d48]">*</span>
                  </label>
                  <select
                    value={form.language}
                    onChange={(e) =>
                      patch('language', e.target.value as 'uz' | 'en')
                    }
                    className={fieldInput}
                  >
                    <option value="en">Ingliz tili</option>
                    <option value="uz">O&apos;zbek tili</option>
                  </select>
                  <p className="text-[11px] text-[#94a3b8] font-semibold mt-1">
                    AI shu tilda gapiradi
                  </p>
                </div>
                <div>
                  <label className={fieldLabel}>
                    Maks. davomiyligi (daqiqa)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={form.maxMinutes}
                    onChange={(e) =>
                      patch(
                        'maxMinutes',
                        Math.max(
                          2,
                          Math.min(60, Number(e.target.value) || 10),
                        ),
                      )
                    }
                    className={fieldInput}
                  />
                  <p className="text-[11px] text-[#94a3b8] font-semibold mt-1">
                    AI shu vaqt atrofida tugatadi
                  </p>
                </div>
              </div>
              <div>
                <label className={fieldLabel}>
                  AI nimani so&apos;rasin?{' '}
                  <span className="text-[#e11d48]">*</span>
                </label>
                <textarea
                  value={form.aiPrompt}
                  onChange={(e) => patch('aiPrompt', e.target.value)}
                  className={`${fieldInput} min-h-[120px] resize-y`}
                  placeholder={`Misol: Talabaga sevimli ovqati haqida 2 ta savol ber. Keyin oilasi haqida so'ra. Ohirida bugungi ob-havoni tasvirlashini so'ra. Grammatika, lug'at boyligi va ravonligini 0-100 ball bilan baho.`}
                />
                <p className="text-[11px] text-[#94a3b8] font-semibold mt-1">
                  AI imtihon davomida shu yo&apos;l-yo&apos;riq asosida
                  savollar beradi va javoblarni baholaydi.
                </p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
                <span className="text-violet-700 shrink-0 mt-0.5">ℹ️</span>
                <p className="text-[11px] font-bold text-violet-800 leading-snug">
                  AI og&apos;zaki imtihonda yuqoridagi
                  &quot;Savollar&quot; bo&apos;limi ishlatilmaydi —
                  AI prompt asosida AI o&apos;zi savol beradi.
                  O&apos;quvchi ovozi orqali javob beradi va AI oxirida{' '}
                  {form.passThreshold}% chegarasi bo&apos;yicha qaror chiqaradi.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Questions section — only for kind=test. AI oral exams are
            driven by aiPrompt and don't need a question list. */}
        {form.kind === 'test' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Savollar ({form.questions.length})
            </p>
            <button
              type="button"
              onClick={openTypePicker}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0d9488] bg-white hover:bg-[#0d9488]/5 border border-[#0d9488]/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Yangi savol
            </button>
          </div>

          {form.questions.length === 0 ? (
            <button
              type="button"
              onClick={openTypePicker}
              className="w-full border-2 border-dashed border-[#ede9e1] rounded-2xl py-10 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-white transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-[#f7f4ef] flex items-center justify-center">
                <span className="text-2xl font-bold">+</span>
              </div>
              <p className="text-sm font-bold">Birinchi savolni qo&apos;shing</p>
              <p className="text-xs text-[#64748b] font-semibold">
                12 turdagi mashq mavjud
              </p>
            </button>
          ) : (
            <>
              <ul className="space-y-2">
                {form.questions.map((q, idx) => {
                  const label = COMPONENT_LABELS[q.type] ?? q.type;
                  const badgeClass =
                    COMPONENT_BADGE_STYLES[q.type] ??
                    'bg-slate-50 text-slate-700 border-slate-200';
                  const Icon = COMPONENT_ICONS[q.type];
                  // Build a fake ConfigComponent for summarizeConfig
                  const fakeComp = { id: String(idx), type: q.type, config: q.config };
                  const summary = summarizeConfig(fakeComp);
                  return (
                    <li
                      key={idx}
                      className="group bg-white rounded-2xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488]/40 hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="p-3 flex items-start gap-3">
                        {/* Order badge */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                            #{idx + 1}
                          </span>
                          <div
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${badgeClass}`}
                          >
                            {Icon ? <Icon size={16} /> : null}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}
                            >
                              {label}
                            </span>
                          </div>
                          <p className="text-sm text-[#0f172a] font-semibold mt-1 line-clamp-2">
                            {summary}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, -1)}
                              aria-label="Yuqoriga"
                              className="text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1.5 rounded hover:bg-[#f7f4ef]"
                            >
                              ↑
                            </button>
                          )}
                          {idx < form.questions.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveQuestion(idx, 1)}
                              aria-label="Pastga"
                              className="text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1.5 rounded hover:bg-[#f7f4ef]"
                            >
                              ↓
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(idx)}
                            aria-label={`${label} tahrirlash`}
                            className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a] bg-[#f7f4ef] hover:bg-[#ede9e1] border border-[#ede9e1] px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Tahrir
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(idx)}
                            aria-label="Savolni o'chirish"
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={openTypePicker}
                className="w-full border-2 border-dashed border-[#ede9e1] rounded-2xl py-3.5 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-white text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                + Yana savol qo&apos;shish
              </button>
            </>
          )}
        </section>
        )}

        {/* Validation tip — only meaningful for test exams */}
        {form.kind === 'test' && form.questions.length === 0 && (
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

      {/* Type-picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Savol turini tanlang"
        size="md"
        theme="light"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_TYPES.map((t) => {
            const Icon = COMPONENT_ICONS[t];
            const badge = COMPONENT_BADGE_STYLES[t] ?? '';
            return (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                className="text-left px-3 py-2.5 rounded-xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488] hover:bg-[#f7f4ef] transition-colors flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${badge}`}
                >
                  {Icon ? <Icon size={16} /> : null}
                </div>
                <span className="text-sm font-bold text-[#0f172a]">
                  {COMPONENT_LABELS[t]}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Configurator modal */}
      <Modal
        open={configType !== null}
        onClose={closeConfigurator}
        title={
          editingQuestion
            ? `${COMPONENT_LABELS[editingQuestion.type] ?? editingQuestion.type} — tahrir`
            : configType
              ? `${COMPONENT_LABELS[configType] ?? configType} — yangi`
              : ''
        }
        size="lg"
        theme="light"
      >
        {configType && (
          <ComponentConfigurator
            type={configType}
            initialConfig={editingQuestion?.config}
            onSubmit={handleConfigSubmit}
            onCancel={closeConfigurator}
            saving={savingConfig}
          />
        )}
      </Modal>
    </div>
  );
}
