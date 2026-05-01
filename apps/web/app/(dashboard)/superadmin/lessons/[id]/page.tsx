'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Globe, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, useToast, Modal } from '@/components/ui';
import {
  ComponentsList,
  COMPONENT_LABELS,
  type ConfigComponent,
} from './_components/ComponentsList';
import {
  ComponentConfigurator,
  ALL_TYPES,
  type ComponentTypeKey,
} from './_components/ComponentConfigurator';

interface Lesson {
  id: string;
  title: string;
  type: string;
  orderNumber: number;
  youtubeUrl: string;
  nRepetitions: number;
  isPublished: boolean;
  components: Record<string, boolean>;
}

interface McqQuestion {
  text: string;
  options: string[];
  correct: number;
}

interface WordOrderSentence {
  words: string[];
  correct: string;
}

/**
 * Pass 5 — Lesson edit page with full Components Configurator.
 *
 * Adds a third "Topshiriqlar" tab that lists every component (the 12
 * supported types) for the lesson, with Add / Edit / Delete wired to
 * `POST/PATCH/DELETE /lessons/:lessonId/components`. The legacy MCQ /
 * Word-order tabs stay as-is for backward-compatible aggregate edits, but
 * the Topshiriqlar tab is now the canonical authoring surface for the new
 * exercise types from Passes 2-4.
 */
export default function EditLessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [components, setComponents] = useState<ConfigComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'mcq' | 'word_order' | 'components'>(
    'components',
  );

  const [mcqQuestions, setMcqQuestions] = useState<McqQuestion[]>([]);
  const [savingMcq, setSavingMcq] = useState(false);

  const [wordSentences, setWordSentences] = useState<WordOrderSentence[]>([]);
  const [savingWord, setSavingWord] = useState(false);

  // Configurator modal state — open with `null` editingComponent for "add",
  // or with a row for "edit". Type picker is its own modal.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configType, setConfigType] = useState<ComponentTypeKey | null>(null);
  const [editingComponent, setEditingComponent] = useState<ConfigComponent | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refreshComponents() {
    const token = localStorage.getItem('accessToken') ?? '';
    const compRes = await apiRequest<ConfigComponent[]>(
      `/lessons/${id}/components`,
      {},
      token,
    );
    setComponents(compRes.data);
    const mcqComp = compRes.data.find((c) => c.type === 'mcq');
    const wordComp = compRes.data.find((c) => c.type === 'word_order');
    const mcqCfg = mcqComp?.config as { questions?: McqQuestion[] } | undefined;
    const wordCfg = wordComp?.config as { sentences?: WordOrderSentence[] } | undefined;
    if (mcqCfg?.questions) setMcqQuestions(mcqCfg.questions);
    if (wordCfg?.sentences) setWordSentences(wordCfg.sentences);
  }

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Lesson>(`/lessons/${id}`, {}, token),
      apiRequest<ConfigComponent[]>(`/lessons/${id}/components`, {}, token),
    ])
      .then(([lessonRes, compRes]) => {
        setLesson(lessonRes.data);
        setComponents(compRes.data);
        const mcqComp = compRes.data.find((c) => c.type === 'mcq');
        const wordComp = compRes.data.find((c) => c.type === 'word_order');
        const mcqCfg = mcqComp?.config as { questions?: McqQuestion[] } | undefined;
        const wordCfg = wordComp?.config as { sentences?: WordOrderSentence[] } | undefined;
        if (mcqCfg?.questions) setMcqQuestions(mcqCfg.questions);
        if (wordCfg?.sentences) setWordSentences(wordCfg.sentences);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function publishLesson() {
    setPublishing(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLesson((prev) => (prev ? { ...prev, isPublished: true } : prev));
      toast.success('Dars nashr qilindi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setPublishing(false);
    }
  }

  async function saveMcq() {
    setSavingMcq(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        `/lessons/${id}/mcq`,
        { method: 'POST', body: JSON.stringify({ questions: mcqQuestions }) },
        token,
      );
      toast.success('MCQ savollar saqlandi');
      await refreshComponents();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSavingMcq(false);
    }
  }

  async function saveWordOrder() {
    setSavingWord(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        `/lessons/${id}/word-order`,
        { method: 'POST', body: JSON.stringify({ sentences: wordSentences }) },
        token,
      );
      toast.success("So'z tartibi saqlandi");
      await refreshComponents();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSavingWord(false);
    }
  }

  function addMcqQuestion() {
    setMcqQuestions((prev) => [...prev, { text: '', options: ['', '', '', ''], correct: 0 }]);
  }
  function updateMcqQuestion(idx: number, field: string, value: string | number) {
    setMcqQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  }
  function updateMcqOption(qIdx: number, optIdx: number, value: string) {
    setMcqQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === optIdx ? value : o)) } : q,
      ),
    );
  }
  function removeMcqQuestion(idx: number) {
    setMcqQuestions((prev) => prev.filter((_, i) => i !== idx));
  }
  function addWordSentence() {
    setWordSentences((prev) => [...prev, { words: [], correct: '' }]);
  }
  function updateWordSentence(idx: number, correct: string) {
    const words = correct.trim().split(/\s+/).filter(Boolean);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWordSentences((prev) =>
      prev.map((s, i) => (i === idx ? { words: shuffled, correct } : s)),
    );
  }
  function removeWordSentence(idx: number) {
    setWordSentences((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Configurator handlers ────────────────────────────────────────────────

  function openTypePicker() {
    setEditingComponent(null);
    setConfigType(null);
    setPickerOpen(true);
  }

  function pickType(type: ComponentTypeKey) {
    setPickerOpen(false);
    setEditingComponent(null);
    setConfigType(type);
  }

  function openEdit(comp: ConfigComponent) {
    setEditingComponent(comp);
    setConfigType(comp.type as ComponentTypeKey);
  }

  function closeConfigurator() {
    setConfigType(null);
    setEditingComponent(null);
  }

  async function handleConfigSubmit(config: Record<string, unknown>) {
    if (!configType) return;
    setSavingConfig(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      if (editingComponent) {
        await apiRequest(
          `/lessons/${id}/components/${editingComponent.id}`,
          { method: 'PATCH', body: JSON.stringify({ config }) },
          token,
        );
        toast.success('Topshiriq yangilandi');
      } else {
        await apiRequest(
          `/lessons/${id}/components`,
          { method: 'POST', body: JSON.stringify({ type: configType, config }) },
          token,
        );
        toast.success("Topshiriq qo'shildi");
      }
      await refreshComponents();
      closeConfigurator();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleDelete(comp: ConfigComponent) {
    if (!window.confirm(`"${COMPONENT_LABELS[comp.type] ?? comp.type}" topshirig'ini o'chirmoqchimisiz?`)) {
      return;
    }
    setDeletingId(comp.id);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        `/lessons/${id}/components/${comp.id}`,
        { method: 'DELETE' },
        token,
      );
      toast.success("Topshiriq o'chirildi");
      await refreshComponents();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] p-4 md:p-6 space-y-4">
        <Skeleton theme="light" className="h-6 w-32" />
        <Skeleton theme="light" className="h-8 w-64" />
        <Skeleton theme="light" className="h-24 w-full rounded-[18px]" />
        <Skeleton theme="light" className="h-12 w-full rounded-[18px]" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <EmptyState
          theme="light"
          icon={<BookOpen size={28} />}
          title="Dars topilmadi"
          description="Bunday ID li dars mavjud emas"
        />
      </div>
    );
  }

  const componentsTotal = components.length;

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/superadmin/lessons')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm"
          >
            <ArrowLeft size={16} /> Darslar
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-base leading-tight">{lesson.title}</p>
            </div>
            {!lesson.isPublished ? (
              <Button
                variant="success"
                size="sm"
                loading={publishing}
                icon={<Globe size={14} />}
                onClick={publishLesson}
              >
                {publishing ? '...' : 'Nashr'}
              </Button>
            ) : (
              <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0">
                <CheckCircle size={12} /> Nashr
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Info panel */}
        <div className="bg-[#162032] rounded-[18px] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[#64748b] text-xs">Tartib</p>
            <p className="text-white font-bold">#{lesson.orderNumber}</p>
          </div>
          <div>
            <p className="text-[#64748b] text-xs">Turi</p>
            <p className="text-white font-bold">{lesson.type}</p>
          </div>
          <div>
            <p className="text-[#64748b] text-xs">N takror</p>
            <p className="text-white font-bold">{lesson.nRepetitions}x</p>
          </div>
          <div>
            <p className="text-[#64748b] text-xs">YouTube</p>
            <a
              href={lesson.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#0d9488] font-bold text-sm hover:underline"
            >
              Ko&apos;rish
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-1 overflow-x-auto">
          {(
            [
              { key: 'info', label: 'Umumiy' },
              { key: 'components', label: `Topshiriqlar (${componentsTotal})` },
              { key: 'mcq', label: `MCQ (${mcqQuestions.length})` },
              { key: 'word_order', label: `So'z (${wordSentences.length})` },
            ] as { key: typeof activeTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-fit py-2.5 px-3 rounded-xl text-sm font-bold transition-colors ${
                activeTab === tab.key ? 'bg-[#0f172a] text-white' : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Umumiy */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
            <p className="text-[#64748b] text-sm">
              Dars ma&apos;lumotlarini tahrirlash uchun yangi dars yarating yoki administrator
              bilan bog&apos;laning. Topshiriqlar tabidan barcha 12 turdagi komponentni boshqaring.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                Yoqilgan komponentlar
              </p>
              <div className="flex gap-2 flex-wrap">
                {componentsTotal === 0 && (
                  <span className="text-[#94a3b8] text-sm">Komponent yo&apos;q</span>
                )}
                {componentsTotal > 0 && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-100 text-xs px-3 py-1 rounded-full font-semibold">
                    Jami: {componentsTotal} ta
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Components configurator (Pass 5) */}
        {activeTab === 'components' && (
          <ComponentsList
            components={components}
            onAdd={openTypePicker}
            onEdit={openEdit}
            onDelete={handleDelete}
            isDeleting={deletingId}
          />
        )}

        {/* Tab: MCQ (legacy aggregate editor) */}
        {activeTab === 'mcq' && (
          <div className="space-y-3">
            {mcqQuestions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                    Savol {qIdx + 1}
                  </span>
                  <button
                    onClick={() => removeMcqQuestion(qIdx)}
                    aria-label="Savolni o'chirish"
                    className="text-[#e11d48] hover:bg-[#e11d48]/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateMcqQuestion(qIdx, 'text', e.target.value)}
                  aria-label={`${qIdx + 1}-savol matni`}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
                  placeholder="Savol matni..."
                />
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => updateMcqQuestion(qIdx, 'correct', optIdx)}
                        aria-label={`${optIdx + 1}-javobni to'g'ri deb belgilash`}
                        aria-pressed={q.correct === optIdx}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          q.correct === optIdx ? 'border-emerald-500 bg-emerald-500' : 'border-[#ede9e1]'
                        }`}
                      >
                        {q.correct === optIdx && <div className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateMcqOption(qIdx, optIdx, e.target.value)}
                        aria-label={`${qIdx + 1}-savol, ${optIdx + 1}-javob`}
                        className={`flex-1 border rounded-xl px-3 py-1.5 text-sm focus:outline-none bg-[#f7f4ef] text-[#0f172a] ${
                          q.correct === optIdx
                            ? 'border-emerald-300 focus:border-emerald-500'
                            : 'border-[#ede9e1] focus:border-[#0f172a]'
                        }`}
                        placeholder={`Javob ${optIdx + 1}`}
                      />
                      {q.correct === optIdx && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={addMcqQuestion}
              className="w-full border-2 border-dashed border-[#ede9e1] rounded-[18px] py-4 text-[#64748b] hover:border-[#0f172a] hover:text-[#0f172a] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Savol qo&apos;shish
            </button>

            {mcqQuestions.length > 0 && (
              <Button variant="primary" loading={savingMcq} fullWidth size="lg" onClick={saveMcq}>
                {savingMcq ? 'Saqlanmoqda...' : `MCQ savollarni saqlash (${mcqQuestions.length} ta)`}
              </Button>
            )}
          </div>
        )}

        {/* Tab: Word Order (legacy aggregate editor) */}
        {activeTab === 'word_order' && (
          <div className="space-y-3">
            <p className="text-sm text-[#64748b]">
              To&apos;g&apos;ri jumlani kiriting — so&apos;zlar avtomatik aralashtiriladi.
            </p>

            {wordSentences.map((s, idx) => (
              <div key={idx} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                    Jumla {idx + 1}
                  </span>
                  <button
                    onClick={() => removeWordSentence(idx)}
                    className="text-[#e11d48] hover:bg-[#e11d48]/10 p-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={s.correct}
                  onChange={(e) => updateWordSentence(idx, e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
                  placeholder="To'g'ri jumla (masalan: I am a student)"
                />
                {s.words.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-[#94a3b8] w-full">Aralashtirilgan:</span>
                    {s.words.map((w, wi) => (
                      <span
                        key={wi}
                        className="bg-[#f7f4ef] text-[#64748b] text-xs px-2 py-0.5 rounded-lg border border-[#ede9e1]"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={addWordSentence}
              className="w-full border-2 border-dashed border-[#ede9e1] rounded-[18px] py-4 text-[#64748b] hover:border-[#0f172a] hover:text-[#0f172a] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Jumla qo&apos;shish
            </button>

            {wordSentences.length > 0 && (
              <Button variant="primary" loading={savingWord} fullWidth size="lg" onClick={saveWordOrder}>
                {savingWord ? 'Saqlanmoqda...' : `So'z tartibi saqlash (${wordSentences.length} ta)`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Type-picker modal */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Topshiriq turini tanlang"
        size="md"
        theme="light"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => pickType(t)}
              className="text-left px-3 py-2 rounded-xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488] hover:bg-[#f7f4ef] transition-colors text-sm font-semibold text-[#0f172a]"
            >
              {COMPONENT_LABELS[t]}
            </button>
          ))}
        </div>
      </Modal>

      {/* Configurator modal */}
      <Modal
        open={configType !== null}
        onClose={closeConfigurator}
        title={
          editingComponent
            ? `${COMPONENT_LABELS[editingComponent.type] ?? editingComponent.type} — tahrir`
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
            initialConfig={editingComponent?.config}
            onSubmit={handleConfigSubmit}
            onCancel={closeConfigurator}
            saving={savingConfig}
          />
        )}
      </Modal>
    </div>
  );
}
