'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Globe,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LandingItem {
  id: string;
  kind: 'prize' | 'sponsor' | 'milestone';
  title: string;
  description: string | null;
  meta: Record<string, string> | null;
  orderIndex: number;
  isVisible: boolean;
}

type MilestoneTier = 'gold' | 'silver' | 'mini';

type Settings = Record<string, string>;

// ─── Helper ──────────────────────────────────────────────────────────────────

function getToken() {
  return typeof window !== 'undefined'
    ? (localStorage.getItem('accessToken') ?? '')
    : '';
}

// ─── Input component ─────────────────────────────────────────────────────────

function Field({
  label,
  id,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const base =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] transition-colors';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base + ' resize-y'}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}
    </div>
  );
}

// ─── Save button ─────────────────────────────────────────────────────────────

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
    >
      {saving ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <Save size={14} />
      )}
      Saqlash
    </button>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#ede9e1] bg-[#fffaf0]">
        <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-widest">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Items section (Prizes / Sponsors) ───────────────────────────────────────

interface ItemsSectionProps {
  kind: 'prize' | 'sponsor';
  sectionTitle: string;
  titleKey: string;
  subtitleKey: string;
  settings: Settings;
  onSettingChange: (key: string, val: string) => void;
  onSettingsSave: () => void;
  settingsSaving: boolean;
}

function ItemsSection({
  kind,
  sectionTitle,
  titleKey,
  subtitleKey,
  settings,
  onSettingChange,
  onSettingsSave,
  settingsSaving,
}: ItemsSectionProps) {
  const toast = useToast();
  const [items, setItems] = useState<LandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [newRow, setNewRow] = useState<{
    title: string;
    description: string;
    metaA: string; // lessonCount | city
    metaB: string; // icon | emoji
    orderIndex: string;
  } | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const metaALabel = kind === 'prize' ? 'Dars soni' : 'Shahar';
  const metaBLabel = kind === 'prize' ? 'Ikonka (emoji)' : 'Emoji';
  const metaAKey = kind === 'prize' ? 'lessonCount' : 'city';
  const metaBKey = kind === 'prize' ? 'icon' : 'emoji';

  useEffect(() => {
    const token = getToken();
    apiRequest<LandingItem[]>(`/marketing/admin/items?kind=${kind}`, {}, token)
      .then((r) => setItems(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Yuklab boʼlmadi'))
      .finally(() => setLoading(false));
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchItem(id: string, patch: Partial<LandingItem>) {
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const token = getToken();
      const res = await apiRequest<LandingItem>(
        `/marketing/admin/items/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        token,
      );
      setItems((prev) => prev.map((it) => (it.id === id ? res.data : it)));
      toast.success('Saqlandi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  async function deleteItem(id: string) {
    setDeleting((p) => ({ ...p, [id]: true }));
    try {
      const token = getToken();
      await apiRequest(`/marketing/admin/items/${id}`, { method: 'DELETE' }, token);
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success("Oʼhirildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDeleting((p) => ({ ...p, [id]: false }));
    }
  }

  async function addItem() {
    if (!newRow || !newRow.title.trim()) return;
    setAddSaving(true);
    try {
      const token = getToken();
      const meta: Record<string, string> = {};
      if (newRow.metaA.trim()) meta[metaAKey] = newRow.metaA.trim();
      if (newRow.metaB.trim()) meta[metaBKey] = newRow.metaB.trim();
      const body = {
        kind,
        title: newRow.title.trim(),
        description: newRow.description.trim() || null,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
        orderIndex: newRow.orderIndex ? Number(newRow.orderIndex) : undefined,
      };
      const res = await apiRequest<LandingItem>(
        '/marketing/admin/items',
        { method: 'POST', body: JSON.stringify(body) },
        token,
      );
      setItems((prev) => [...prev, res.data]);
      setNewRow(null);
      toast.success("Qoʻshildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <SectionCard title={sectionTitle}>
      {/* Section title/subtitle settings */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Field
          label="Sarlavha"
          id={`${kind}-title`}
          value={settings[titleKey] ?? ''}
          onChange={(v) => onSettingChange(titleKey, v)}
        />
        <Field
          label="Izoh"
          id={`${kind}-subtitle`}
          value={settings[subtitleKey] ?? ''}
          onChange={(v) => onSettingChange(subtitleKey, v)}
        />
      </div>
      <div className="mb-6">
        <SaveBtn saving={settingsSaving} onClick={onSettingsSave} />
      </div>

      {/* Items list */}
      <div className="border-t border-[#ede9e1] pt-5">
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-4">
          Elementlar
        </p>

        {loading ? (
          <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                metaALabel={metaALabel}
                metaAKey={metaAKey}
                metaBLabel={metaBLabel}
                metaBKey={metaBKey}
                saving={!!saving[item.id]}
                deleting={!!deleting[item.id]}
                onSave={(patch) => patchItem(item.id, patch)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>
        )}

        {/* New row */}
        {newRow ? (
          <div className="mt-4 bg-[#f7f4ef] rounded-xl border border-[#ede9e1] p-4 space-y-3">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b]">
              Yangi element
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Nomi"
                id="new-title"
                value={newRow.title}
                onChange={(v) => setNewRow((p) => p && { ...p, title: v })}
              />
              <Field
                label="Tavsif"
                id="new-desc"
                value={newRow.description}
                onChange={(v) => setNewRow((p) => p && { ...p, description: v })}
              />
              <Field
                label={metaALabel}
                id="new-meta-a"
                value={newRow.metaA}
                onChange={(v) => setNewRow((p) => p && { ...p, metaA: v })}
              />
              <Field
                label={metaBLabel}
                id="new-meta-b"
                value={newRow.metaB}
                onChange={(v) => setNewRow((p) => p && { ...p, metaB: v })}
              />
              <Field
                label="Tartib raqami"
                id="new-order"
                value={newRow.orderIndex}
                onChange={(v) => setNewRow((p) => p && { ...p, orderIndex: v })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addItem}
                disabled={addSaving || !newRow.title.trim()}
                className="inline-flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#0f766e] transition-colors"
              >
                {addSaving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Qo&apos;shish
              </button>
              <button
                type="button"
                onClick={() => setNewRow(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#64748b] hover:text-[#0f172a] transition-colors"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              setNewRow({ title: '', description: '', metaA: '', metaB: '', orderIndex: '' })
            }
            className="mt-4 inline-flex items-center gap-2 border-2 border-dashed border-[#ede9e1] hover:border-[#0d9488] text-[#64748b] hover:text-[#0d9488] px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            <Plus size={14} />
            Yangi {kind === 'prize' ? 'mukofot' : 'homiy'} qo&apos;shish
          </button>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Item row (inline editable) ───────────────────────────────────────────────

interface ItemRowProps {
  item: LandingItem;
  metaALabel: string;
  metaAKey: string;
  metaBLabel: string;
  metaBKey: string;
  saving: boolean;
  deleting: boolean;
  onSave: (patch: Partial<LandingItem> & { meta?: Record<string, string> }) => void;
  onDelete: () => void;
}

function ItemRow({
  item,
  metaALabel,
  metaAKey,
  metaBLabel,
  metaBKey,
  saving,
  deleting,
  onSave,
  onDelete,
}: ItemRowProps) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [metaA, setMetaA] = useState(item.meta?.[metaAKey] ?? '');
  const [metaB, setMetaB] = useState(item.meta?.[metaBKey] ?? '');
  const [orderIndex, setOrderIndex] = useState(String(item.orderIndex));
  const [isVisible, setIsVisible] = useState(item.isVisible);

  function buildMeta(): Record<string, string> {
    const m: Record<string, string> = { ...item.meta };
    if (metaA.trim()) m[metaAKey] = metaA.trim(); else delete m[metaAKey];
    if (metaB.trim()) m[metaBKey] = metaB.trim(); else delete m[metaBKey];
    return m;
  }

  function save() {
    onSave({
      title: title.trim() || item.title,
      description: description.trim() || null,
      meta: buildMeta(),
      orderIndex: orderIndex ? Number(orderIndex) : item.orderIndex,
      isVisible,
    });
  }

  const inputCls =
    'bg-[#f7f4ef] border border-[#ede9e1] rounded-lg px-2.5 py-1.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] w-full transition-colors';

  return (
    <div className="bg-[#f7f4ef] rounded-xl border border-[#ede9e1] p-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Nomi</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Tavsif</label>
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">{metaALabel}</label>
          <input className={inputCls} value={metaA} onChange={(e) => setMetaA(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">{metaBLabel}</label>
          <input className={inputCls} value={metaB} onChange={(e) => setMetaB(e.target.value)} maxLength={4} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Tartib</label>
          <input
            className={inputCls}
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() => setIsVisible((p) => !p)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
            isVisible
              ? 'bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20'
              : 'bg-[#94a3b8]/10 text-[#94a3b8] hover:bg-[#94a3b8]/20'
          }`}
        >
          {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          {isVisible ? "Ko'rinadigan" : 'Yashirin'}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#0f172a] text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            {saving ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={11} />
            )}
            Saqlash
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-rose-100 transition-colors"
          >
            {deleting ? (
              <span className="w-3 h-3 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
            ) : (
              <Trash2 size={11} />
            )}
            O&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Milestones section ─────────────────────────────────────────────────────

const TIER_LABEL: Record<MilestoneTier, string> = {
  mini: "Mini (to'q sariq)",
  silver: 'Silver (binafsha)',
  gold: 'Gold (oltin)',
};
const TIER_DOT_BG: Record<MilestoneTier, string> = {
  mini: '#f97316',
  silver: '#6d28d9',
  gold: '#fbbf24',
};

function MilestonesSection() {
  const toast = useToast();
  const [items, setItems] = useState<LandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [newRow, setNewRow] = useState<{
    title: string;
    step: string;
    tier: MilestoneTier;
    orderIndex: string;
  } | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    apiRequest<LandingItem[]>('/marketing/admin/items?kind=milestone', {}, token)
      .then((r) => setItems(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Yuklab boʼlmadi'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchItem(id: string, patch: Partial<LandingItem>) {
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      const token = getToken();
      const res = await apiRequest<LandingItem>(
        `/marketing/admin/items/${id}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        token,
      );
      setItems((prev) => prev.map((it) => (it.id === id ? res.data : it)));
      toast.success('Saqlandi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  }

  async function deleteItem(id: string) {
    setDeleting((p) => ({ ...p, [id]: true }));
    try {
      const token = getToken();
      await apiRequest(`/marketing/admin/items/${id}`, { method: 'DELETE' }, token);
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success("Oʼchirildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setDeleting((p) => ({ ...p, [id]: false }));
    }
  }

  async function addItem() {
    if (!newRow || !newRow.title.trim() || !newRow.step.trim()) return;
    setAddSaving(true);
    try {
      const token = getToken();
      const body = {
        kind: 'milestone' as const,
        title: newRow.title.trim(),
        meta: { step: newRow.step.trim(), tier: newRow.tier },
        orderIndex: newRow.orderIndex ? Number(newRow.orderIndex) : undefined,
      };
      const res = await apiRequest<LandingItem>(
        '/marketing/admin/items',
        { method: 'POST', body: JSON.stringify(body) },
        token,
      );
      setItems((prev) => [...prev, res.data]);
      setNewRow(null);
      toast.success("Qoʻshildi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setAddSaving(false);
    }
  }

  const inputCls =
    'bg-[#f7f4ef] border border-[#ede9e1] rounded-lg px-2.5 py-1.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] w-full transition-colors';

  return (
    <div className="border-t border-[#ede9e1] pt-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-4">
        Milestone&apos;lar (mukofotli qadamlar)
      </p>

      {loading ? (
        <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <MilestoneRow
              key={item.id}
              item={item}
              saving={!!saving[item.id]}
              deleting={!!deleting[item.id]}
              onSave={(patch) => patchItem(item.id, patch)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </div>
      )}

      {newRow ? (
        <div className="mt-4 bg-[#f7f4ef] rounded-xl border border-[#ede9e1] p-4 space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b]">
            Yangi milestone
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              label="Nomi (label)"
              id="new-ms-title"
              value={newRow.title}
              onChange={(v) => setNewRow((p) => p && { ...p, title: v })}
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                Daraja
              </label>
              <select
                value={newRow.tier}
                onChange={(e) =>
                  setNewRow((p) => p && { ...p, tier: e.target.value as MilestoneTier })
                }
                className={inputCls}
              >
                <option value="mini">{TIER_LABEL.mini}</option>
                <option value="silver">{TIER_LABEL.silver}</option>
                <option value="gold">{TIER_LABEL.gold}</option>
              </select>
            </div>
            <Field
              label="Qadam raqami"
              id="new-ms-step"
              value={newRow.step}
              onChange={(v) => setNewRow((p) => p && { ...p, step: v })}
            />
            <Field
              label="Tartib raqami"
              id="new-ms-order"
              value={newRow.orderIndex}
              onChange={(v) => setNewRow((p) => p && { ...p, orderIndex: v })}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addItem}
              disabled={addSaving || !newRow.title.trim() || !newRow.step.trim()}
              className="inline-flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#0f766e] transition-colors"
            >
              {addSaving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Qo&apos;shish
            </button>
            <button
              type="button"
              onClick={() => setNewRow(null)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#64748b] hover:text-[#0f172a] transition-colors"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            setNewRow({ title: '', step: '', tier: 'mini', orderIndex: '' })
          }
          className="mt-4 inline-flex items-center gap-2 border-2 border-dashed border-[#ede9e1] hover:border-[#0d9488] text-[#64748b] hover:text-[#0d9488] px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          <Plus size={14} />
          Yangi milestone qo&apos;shish
        </button>
      )}
    </div>
  );
}

interface MilestoneRowProps {
  item: LandingItem;
  saving: boolean;
  deleting: boolean;
  onSave: (patch: Partial<LandingItem> & { meta?: Record<string, string> }) => void;
  onDelete: () => void;
}

function MilestoneRow({ item, saving, deleting, onSave, onDelete }: MilestoneRowProps) {
  const initialTier =
    (item.meta?.tier as MilestoneTier | undefined) ?? 'mini';
  const [title, setTitle] = useState(item.title);
  const [step, setStep] = useState(item.meta?.step ?? '');
  const [tier, setTier] = useState<MilestoneTier>(initialTier);
  const [orderIndex, setOrderIndex] = useState(String(item.orderIndex));
  const [isVisible, setIsVisible] = useState(item.isVisible);

  function save() {
    onSave({
      title: title.trim() || item.title,
      meta: { step: step.trim(), tier },
      orderIndex: orderIndex ? Number(orderIndex) : item.orderIndex,
      isVisible,
    });
  }

  const inputCls =
    'bg-[#f7f4ef] border border-[#ede9e1] rounded-lg px-2.5 py-1.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] w-full transition-colors';

  return (
    <div className="bg-[#f7f4ef] rounded-xl border border-[#ede9e1] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="w-3.5 h-3.5 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: TIER_DOT_BG[tier] }}
          aria-hidden
        />
        <span className="text-xs font-extrabold text-[#0f172a]">{TIER_LABEL[tier]}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Nomi</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Daraja</label>
          <select
            className={inputCls}
            value={tier}
            onChange={(e) => setTier(e.target.value as MilestoneTier)}
          >
            <option value="mini">{TIER_LABEL.mini}</option>
            <option value="silver">{TIER_LABEL.silver}</option>
            <option value="gold">{TIER_LABEL.gold}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Qadam raqami</label>
          <input className={inputCls} type="number" value={step} onChange={(e) => setStep(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">Tartib</label>
          <input className={inputCls} type="number" value={orderIndex} onChange={(e) => setOrderIndex(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsVisible((p) => !p)}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
            isVisible
              ? 'bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20'
              : 'bg-[#94a3b8]/10 text-[#94a3b8] hover:bg-[#94a3b8]/20'
          }`}
        >
          {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
          {isVisible ? "Ko'rinadigan" : 'Yashirin'}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-[#0f172a] text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            {saving ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={11} />
            )}
            Saqlash
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-500 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-rose-100 transition-colors"
          >
            {deleting ? (
              <span className="w-3 h-3 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin" />
            ) : (
              <Trash2 size={11} />
            )}
            O&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SuperadminLandingPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  // Per-section saving state
  const [savingHero, setSavingHero] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingCert, setSavingCert] = useState(false);
  const [savingPrizesMeta, setSavingPrizesMeta] = useState(false);
  const [savingSponsorsMeta, setSavingSponsorsMeta] = useState(false);
  const [savingJourney, setSavingJourney] = useState(false);

  useEffect(() => {
    const token = getToken();
    apiRequest<Settings>('/marketing/admin/settings', {}, token)
      .then((r) => setSettings(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Yuklab boʼlmadi'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(key: string, val: string) {
    setSettings((p) => ({ ...p, [key]: val }));
  }

  const saveKeys = useCallback(
    async (keys: string[], setSaving: (b: boolean) => void) => {
      setSaving(true);
      try {
        const token = getToken();
        const subset: Settings = {};
        for (const k of keys) subset[k] = settings[k] ?? '';
        await apiRequest<Settings>(
          '/marketing/admin/settings',
          { method: 'PUT', body: JSON.stringify(subset) },
          token,
        );
        toast.success('Saqlandi');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Xatolik');
      } finally {
        setSaving(false);
      }
    },
    [settings], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const HERO_KEYS = ['hero.badge', 'hero.title', 'hero.tagline', 'hero.subtitle', 'hero.cta'];
  const CONTACT_KEYS = ['contact.phone', 'contact.email', 'contact.address', 'contact.telegram', 'contact.personal'];
  const CERT_KEYS = ['certificate.title', 'certificate.description'];
  const PRIZES_META_KEYS = ['prizes.title', 'prizes.subtitle'];
  const SPONSORS_META_KEYS = ['travel.title', 'travel.subtitle'];
  const JOURNEY_KEYS = [
    'journey.badge',
    'journey.title',
    'journey.subtitle',
    'journey.cta',
    'journey.totalSteps',
    'journey.cols',
    'journey.legend.mini',
    'journey.legend.silver',
    'journey.legend.gold',
  ];

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Globe size={18} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
            <p className="text-white font-bold text-lg">Landing CMS</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-10 space-y-5 max-w-3xl">
        {loading ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6">
            <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* ── Hero ──────────────────────────────────────────────────── */}
            <SectionCard title="Hero">
              <div className="space-y-4">
                <Field label="Badge matni" id="hero-badge" value={settings['hero.badge'] ?? ''} onChange={(v) => handleChange('hero.badge', v)} />
                <Field label="Sarlavha (title)" id="hero-title" value={settings['hero.title'] ?? ''} onChange={(v) => handleChange('hero.title', v)} multiline />
                <Field label="Tagline" id="hero-tagline" value={settings['hero.tagline'] ?? ''} onChange={(v) => handleChange('hero.tagline', v)} />
                <Field label="Tavsif (subtitle)" id="hero-subtitle" value={settings['hero.subtitle'] ?? ''} onChange={(v) => handleChange('hero.subtitle', v)} multiline />
                <Field label="CTA tugmasi matni" id="hero-cta" value={settings['hero.cta'] ?? ''} onChange={(v) => handleChange('hero.cta', v)} />
                <SaveBtn saving={savingHero} onClick={() => saveKeys(HERO_KEYS, setSavingHero)} />
              </div>
            </SectionCard>

            {/* ── Aloqa ─────────────────────────────────────────────────── */}
            <SectionCard title="Aloqa (Contact)">
              <div className="space-y-4">
                <Field label="Telefon" id="contact-phone" value={settings['contact.phone'] ?? ''} onChange={(v) => handleChange('contact.phone', v)} />
                <Field label="Email" id="contact-email" value={settings['contact.email'] ?? ''} onChange={(v) => handleChange('contact.email', v)} />
                <Field label="Manzil" id="contact-address" value={settings['contact.address'] ?? ''} onChange={(v) => handleChange('contact.address', v)} multiline />
                <Field label="Telegram (kanal havolasi)" id="contact-telegram" value={settings['contact.telegram'] ?? ''} onChange={(v) => handleChange('contact.telegram', v)} />
                <Field label="Shaxsiy Telegram (havola)" id="contact-personal" value={settings['contact.personal'] ?? ''} onChange={(v) => handleChange('contact.personal', v)} />
                <SaveBtn saving={savingContact} onClick={() => saveKeys(CONTACT_KEYS, setSavingContact)} />
              </div>
            </SectionCard>

            {/* ── Sertifikat ────────────────────────────────────────────── */}
            <SectionCard title="Sertifikat">
              <div className="space-y-4">
                <Field label="Sarlavha" id="cert-title" value={settings['certificate.title'] ?? ''} onChange={(v) => handleChange('certificate.title', v)} />
                <Field label="Tavsif" id="cert-desc" value={settings['certificate.description'] ?? ''} onChange={(v) => handleChange('certificate.description', v)} multiline />
                <SaveBtn saving={savingCert} onClick={() => saveKeys(CERT_KEYS, setSavingCert)} />
              </div>
            </SectionCard>

            {/* ── Mukofotlar ────────────────────────────────────────────── */}
            <ItemsSection
              kind="prize"
              sectionTitle="Mukofotlar (Prizes)"
              titleKey="prizes.title"
              subtitleKey="prizes.subtitle"
              settings={settings}
              onSettingChange={handleChange}
              onSettingsSave={() => saveKeys(PRIZES_META_KEYS, setSavingPrizesMeta)}
              settingsSaving={savingPrizesMeta}
            />

            {/* ── Sayohat homiylari ─────────────────────────────────────── */}
            <ItemsSection
              kind="sponsor"
              sectionTitle="Sayohat homiylari (Sponsors)"
              titleKey="travel.title"
              subtitleKey="travel.subtitle"
              settings={settings}
              onSettingChange={handleChange}
              onSettingsSave={() => saveKeys(SPONSORS_META_KEYS, setSavingSponsorsMeta)}
              settingsSaving={savingSponsorsMeta}
            />

            {/* ── Sayohat (Journey) ─────────────────────────────────────── */}
            <SectionCard title="Sayohat (Journey roadmap)">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Badge" id="journey-badge" value={settings['journey.badge'] ?? ''} onChange={(v) => handleChange('journey.badge', v)} />
                <Field label="Sarlavha" id="journey-title" value={settings['journey.title'] ?? ''} onChange={(v) => handleChange('journey.title', v)} />
              </div>
              <div className="mt-4">
                <Field label="Tavsif" id="journey-subtitle" value={settings['journey.subtitle'] ?? ''} onChange={(v) => handleChange('journey.subtitle', v)} multiline />
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <Field label="CTA tugma matni" id="journey-cta" value={settings['journey.cta'] ?? ''} onChange={(v) => handleChange('journey.cta', v)} />
                <Field label="Jami qadamlar (1–1000)" id="journey-total" value={settings['journey.totalSteps'] ?? ''} onChange={(v) => handleChange('journey.totalSteps', v)} />
                <Field label="Ustunlar (5–60)" id="journey-cols" value={settings['journey.cols'] ?? ''} onChange={(v) => handleChange('journey.cols', v)} />
              </div>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-widest text-[#64748b]">
                Legend (rang izohlari)
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mt-2">
                <Field label="Mini (to'q sariq)" id="journey-legend-mini" value={settings['journey.legend.mini'] ?? ''} onChange={(v) => handleChange('journey.legend.mini', v)} />
                <Field label="Silver (binafsha)" id="journey-legend-silver" value={settings['journey.legend.silver'] ?? ''} onChange={(v) => handleChange('journey.legend.silver', v)} />
                <Field label="Gold (oltin)" id="journey-legend-gold" value={settings['journey.legend.gold'] ?? ''} onChange={(v) => handleChange('journey.legend.gold', v)} />
              </div>
              <div className="mt-5">
                <SaveBtn saving={savingJourney} onClick={() => saveKeys(JOURNEY_KEYS, setSavingJourney)} />
              </div>

              {/* Milestones CRUD */}
              <MilestonesSection />
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
