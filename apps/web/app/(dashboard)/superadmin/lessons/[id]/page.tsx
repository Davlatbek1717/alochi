'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Globe,
  CheckCircle,
  Eye,
  Save,
  ExternalLink,
  Hash,
  Repeat,
  Layers,
  Tag,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, useToast, Modal } from '@/components/ui';
import {
  ComponentsList,
  COMPONENT_LABELS,
  COMPONENT_BADGE_STYLES,
  COMPONENT_ICONS,
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
  maxNOverride?: number | null;
  isPublished: boolean;
  components: Record<string, boolean>;
  hasExam?: boolean;
}

const LESSON_TYPES = [
  { value: 'english', label: 'Ingliz tili' },
  { value: 'personal_development', label: 'Shaxsiy rivojlanish' },
  { value: 'critical_thinking', label: 'Tanqidiy fikrlash' },
  { value: 'experiment', label: 'Tajriba' },
];

/**
 * Pull a YouTube video ID out of any common URL shape so the embed
 * preview works regardless of how the URL was pasted. Mirrors the
 * student-side parser; intentionally permissive.
 */
function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['embed', 'v', 'shorts', 'live'].includes(parts[0])
      ) {
        const id = parts[1];
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

type Tab = 'components' | 'settings';

export default function EditLessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [components, setComponents] = useState<ConfigComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('components');

  // Settings form state — initialised from `lesson` once it loads, then
  // updated locally as the admin types. Saved via PATCH /lessons/:id.
  const [form, setForm] = useState<Lesson | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Configurator modal state.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configType, setConfigType] = useState<ComponentTypeKey | null>(null);
  const [editingComponent, setEditingComponent] = useState<ConfigComponent | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete component confirmation
  const [confirmDeleteComp, setConfirmDeleteComp] = useState<ConfigComponent | null>(null);

  async function refreshComponents() {
    const token = localStorage.getItem('accessToken') ?? '';
    const compRes = await apiRequest<ConfigComponent[]>(
      `/lessons/${id}/components`,
      {},
      token,
    );
    setComponents(compRes.data);
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
        setForm(lessonRes.data);
        setComponents(compRes.data);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether the form differs from the loaded lesson — drives the
  // Save-button enabled state and a "unsaved changes" pill.
  const isDirty = useMemo(() => {
    if (!lesson || !form) return false;
    return (
      form.title !== lesson.title ||
      form.type !== lesson.type ||
      form.orderNumber !== lesson.orderNumber ||
      form.youtubeUrl !== lesson.youtubeUrl ||
      form.nRepetitions !== lesson.nRepetitions ||
      (form.maxNOverride ?? null) !== (lesson.maxNOverride ?? null)
    );
  }, [form, lesson]);

  async function publishLesson() {
    setPublishing(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLesson((prev) => (prev ? { ...prev, isPublished: true } : prev));
      setForm((prev) => (prev ? { ...prev, isPublished: true } : prev));
      toast.success('Dars nashr qilindi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setPublishing(false);
    }
  }

  async function saveSettings() {
    if (!form || !lesson) return;
    setSavingSettings(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      // Send only the fields that actually changed — keeps the PATCH
      // body small and lets validators (e.g. @IsUrl on youtubeUrl)
      // skip untouched values.
      const body: Record<string, unknown> = {};
      if (form.title !== lesson.title) body.title = form.title.trim();
      if (form.type !== lesson.type) body.type = form.type;
      if (form.orderNumber !== lesson.orderNumber)
        body.orderNumber = form.orderNumber;
      if (form.youtubeUrl !== lesson.youtubeUrl)
        body.youtubeUrl = form.youtubeUrl.trim();
      if (form.nRepetitions !== lesson.nRepetitions)
        body.nRepetitions = form.nRepetitions;
      if ((form.maxNOverride ?? null) !== (lesson.maxNOverride ?? null)) {
        body.maxNOverride = form.maxNOverride ?? null;
      }

      const res = await apiRequest<Lesson>(
        `/lessons/${id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
        token,
      );
      // Re-baseline both `lesson` and `form` so isDirty resets cleanly.
      setLesson(res.data);
      setForm(res.data);
      toast.success('Saqlandi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Saqlab boʻlmadi');
    } finally {
      setSavingSettings(false);
    }
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
    setConfirmDeleteComp(comp);
  }

  /**
   * Copy an existing component verbatim — same type, same config —
   * via POST /lessons/:id/components. Saves the author the click-through-
   * the-configurator dance when they want a near-identical exercise.
   */
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  async function handleDuplicate(comp: ConfigComponent) {
    setDuplicatingId(comp.id);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        `/lessons/${id}/components`,
        {
          method: 'POST',
          body: JSON.stringify({ type: comp.type, config: comp.config }),
        },
        token,
      );
      toast.success('Topshiriq nusxalandi');
      await refreshComponents();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function doConfirmDelete() {
    const comp = confirmDeleteComp;
    if (!comp) return;
    setConfirmDeleteComp(null);
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
      <div className="min-h-full bg-[#f7f4ef] p-4 md:p-6 space-y-4">
        <Skeleton theme="light" className="h-6 w-32" />
        <Skeleton theme="light" className="h-8 w-64" />
        <Skeleton theme="light" className="h-24 w-full rounded-2xl" />
        <Skeleton theme="light" className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  if (!lesson || !form) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center">
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
  const ytId = getYoutubeId(form.youtubeUrl);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          {/* Breadcrumb */}
          <button
            onClick={() => router.push('/superadmin/lessons')}
            className="flex items-center gap-2 text-[#94a3b8] text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Darslar
          </button>

          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen size={20} className="text-[#0d9488]" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-base leading-tight line-clamp-2">
                  {lesson.title}
                </p>
                <p className="text-[#94a3b8] text-xs font-semibold mt-1">
                  Tartib #{lesson.orderNumber} ·{' '}
                  {LESSON_TYPES.find((t) => t.value === lesson.type)?.label ??
                    lesson.type}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {!lesson.isPublished ? (
                <Button
                  variant="success"
                  size="sm"
                  loading={publishing}
                  icon={<Globe size={14} />}
                  onClick={publishLesson}
                >
                  {publishing ? '...' : 'Nashr qilish'}
                </Button>
              ) : (
                <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
                  <CheckCircle size={12} /> Nashrda
                </span>
              )}
              <a
                href={`/student/lessons/${lesson.id}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
              >
                <Eye size={12} /> Talaba ko‘zi bilan
              </a>
            </div>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip
              icon={<Hash size={12} />}
              label="Tartib"
              value={`#${lesson.orderNumber}`}
            />
            <StatChip
              icon={<Tag size={12} />}
              label="Turi"
              value={
                LESSON_TYPES.find((t) => t.value === lesson.type)?.label ??
                lesson.type
              }
            />
            <StatChip
              icon={<Repeat size={12} />}
              label="Takror"
              value={`${lesson.nRepetitions}×`}
            />
            <StatChip
              icon={<Layers size={12} />}
              label="Topshiriq"
              value={`${componentsTotal}`}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-1">
          {(
            [
              { key: 'components', label: `Topshiriqlar (${componentsTotal})` },
              { key: 'settings', label: 'Sozlamalar' },
            ] as { key: Tab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#0f172a] text-white'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'components' && (
          <ComponentsList
            components={components}
            onAdd={openTypePicker}
            onEdit={openEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            isDeleting={deletingId}
            isDuplicating={duplicatingId}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsForm
            form={form}
            onChange={setForm}
            isDirty={isDirty}
            saving={savingSettings}
            onSave={saveSettings}
            onReset={() => setForm(lesson)}
            ytId={ytId}
          />
        )}
      </div>

      {/* Type-picker modal — shows every supported component type with
          its colour-coded icon so admins recognise the exercise visually. */}
      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Topshiriq turini tanlang"
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

      {/* Delete component confirmation modal */}
      <Modal
        open={confirmDeleteComp !== null}
        onClose={() => setConfirmDeleteComp(null)}
        title="Topshiriqni o'chirish"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          &quot;{confirmDeleteComp ? (COMPONENT_LABELS[confirmDeleteComp.type] ?? confirmDeleteComp.type) : ''}&quot; topshirig&apos;ini o&apos;chirishni tasdiqlaysizmi?
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setConfirmDeleteComp(null)}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef]"
          >
            Bekor qilish
          </button>
          <button
            onClick={doConfirmDelete}
            className="text-sm px-4 py-2 rounded-xl bg-[#b91c1c] text-white font-semibold hover:bg-red-800"
          >
            O&apos;chirish
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** Compact stat chip for the dark header. */
function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#162032] border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
      <span className="text-[#94a3b8]">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-semibold">
          {label}
        </p>
        <p className="text-white text-xs font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Settings form ──────────────────────────────────────────────────────────

interface SettingsFormProps {
  form: Lesson;
  onChange: (next: Lesson) => void;
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  ytId: string | null;
}

function SettingsForm({
  form,
  onChange,
  isDirty,
  saving,
  onSave,
  onReset,
  ytId,
}: SettingsFormProps) {
  const fieldLabel =
    'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5';
  const fieldInput =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] transition-colors';

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-3">
        <label className={fieldLabel}>
          Dars nomi <span className="text-[#e11d48]">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          className={fieldInput}
          placeholder="Masalan: Present Simple"
        />
      </div>

      {/* Type + order */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>
              Turi <span className="text-[#e11d48]">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value })}
              className={fieldInput}
            >
              {LESSON_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>
              Tartib raqami <span className="text-[#e11d48]">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.orderNumber}
              onChange={(e) =>
                onChange({
                  ...form,
                  orderNumber: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className={fieldInput}
            />
          </div>
        </div>
      </div>

      {/* YouTube + live preview */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-3">
        <label className={fieldLabel}>
          YouTube URL <span className="text-[#94a3b8] font-normal normal-case tracking-normal">(ixtiyoriy)</span>
        </label>
        <div className="relative">
          <LinkIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
          />
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={(e) =>
              onChange({ ...form, youtubeUrl: e.target.value })
            }
            className={`${fieldInput} pl-9`}
            placeholder="https://youtu.be/..."
          />
        </div>
        {form.youtubeUrl && !ytId && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-800">
              Video ID aniqlanmadi — havolani tekshiring (youtu.be / youtube.com / shorts).
            </p>
          </div>
        )}
        {ytId && (
          <div className="rounded-xl overflow-hidden border border-[#ede9e1] aspect-video bg-black">
            <iframe
              key={ytId}
              src={`https://www.youtube.com/embed/${ytId}`}
              title="YouTube preview"
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </div>

      {/* Repetitions */}
      <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>
              N takrorlash <span className="text-[#e11d48]">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.nRepetitions}
              onChange={(e) =>
                onChange({
                  ...form,
                  nRepetitions: Math.max(
                    1,
                    Math.min(10, Number(e.target.value) || 1),
                  ),
                })
              }
              className={fieldInput}
            />
            <p className="text-xs text-[#94a3b8] font-semibold mt-1">
              1–10 oralig&apos;ida
            </p>
          </div>
          <div>
            <label className={fieldLabel}>Maksimum N (ixtiyoriy)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.maxNOverride ?? ''}
              onChange={(e) =>
                onChange({
                  ...form,
                  maxNOverride: e.target.value
                    ? Math.max(1, Math.min(20, Number(e.target.value)))
                    : null,
                })
              }
              className={fieldInput}
              placeholder="Masalan: 10"
            />
            <p className="text-xs text-[#94a3b8] font-semibold mt-1">
              1–20 oralig&apos;ida
            </p>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-3 z-20">
        <div
          className={`flex items-center gap-3 rounded-2xl border-[1.5px] p-3 transition-all shadow-lg ${
            isDirty
              ? 'bg-white border-[#0d9488]/40'
              : 'bg-[#f7f4ef] border-[#ede9e1]'
          }`}
        >
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Saqlanmagan o&apos;zgarish
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle size={12} /> Hammasi saqlangan
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={onReset}
                disabled={saving}
                className="text-xs font-bold text-[#64748b] hover:text-[#0f172a] px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                Bekor qilish
              </button>
            )}
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!isDirty || saving}
              icon={<Save size={14} />}
              onClick={onSave}
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </div>
      </div>

      {/* External-open helper */}
      {form.youtubeUrl && (
        <a
          href={form.youtubeUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#0d9488] hover:underline pt-2"
        >
          YouTube saytida ochish <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}
