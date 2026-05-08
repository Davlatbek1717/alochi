'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Wrench,
  ArrowLeft,
  Send,
  Tablet,
  Mic,
  Camera,
  Wifi,
  MoreHorizontal,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';

type Issue = {
  id: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
};

type CategoryKey = 'tablet' | 'audio' | 'camera' | 'network' | 'other';
type SeverityKey = 'low' | 'medium' | 'high';
type HistoryFilter = 'all' | 'open' | 'resolved';

const CATEGORY_CONFIG: {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: 'tablet', label: 'Planshet', icon: <Tablet size={16} /> },
  { key: 'audio', label: 'Mikrofon', icon: <Mic size={16} /> },
  { key: 'camera', label: 'Kamera', icon: <Camera size={16} /> },
  { key: 'network', label: 'Internet', icon: <Wifi size={16} /> },
  { key: 'other', label: 'Boshqa', icon: <MoreHorizontal size={16} /> },
];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  tablet: 'Planshet',
  audio: 'Mikrofon',
  camera: 'Kamera',
  network: 'Internet',
  other: 'Boshqa',
};

const SEVERITY_CONFIG: {
  key: SeverityKey;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    key: 'low',
    label: 'Past',
    active: 'bg-[#64748b] text-white border-[#64748b]',
    inactive: 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1] hover:bg-[#ede9e1]',
  },
  {
    key: 'medium',
    label: "O'rta",
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'bg-[#f7f4ef] text-amber-700 border-amber-200 hover:bg-amber-50',
  },
  {
    key: 'high',
    label: 'Yuqori',
    active: 'bg-rose-500 text-white border-rose-500',
    inactive: 'bg-[#f7f4ef] text-rose-700 border-rose-200 hover:bg-rose-50',
  },
];

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200',
};
const SEVERITY_LABEL: Record<string, string> = {
  low: 'Past',
  medium: "O'rta",
  high: 'Yuqori',
};

const MAX_DESC = 500;

/** Relative time in Uzbek: "2 soat oldin", "3 daqiqa oldin", etc. */
function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Hozirgina';
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} kun oldin`;
  return `${Math.floor(diff / 604800)} hafta oldin`;
}

export default function TesterTechIssuesPage() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Issue[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('tablet');
  const [severity, setSeverity] = useState<SeverityKey>('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function load() {
    try {
      const r = await apiRequest<Issue[]>('/tech-issues', {}, token());
      setItems(r.data);
    } catch {
      setHistoryLoadError(true);
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest(
        '/tech-issues',
        { method: 'POST', body: JSON.stringify({ category, severity, description: description.trim() }) },
        token(),
      );
      success("Muammo muvaffaqiyatli yuborildi");
      setDescription('');
      await load();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  // History filter counts
  const historyCounts = useMemo(() => {
    const open = items.filter((i) => i.status !== 'resolved').length;
    const resolved = items.filter((i) => i.status === 'resolved').length;
    return { all: items.length, open, resolved };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (historyFilter === 'open') return items.filter((i) => i.status !== 'resolved');
    if (historyFilter === 'resolved') return items.filter((i) => i.status === 'resolved');
    return items;
  }, [items, historyFilter]);

  const historyChips: { key: HistoryFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Hammasi', count: historyCounts.all },
    { key: 'open', label: 'Ochiq', count: historyCounts.open },
    { key: 'resolved', label: 'Bajarilgan', count: historyCounts.resolved },
  ];

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-10">
      {/* Header — dark navy + amber radial accent (staff theme) */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Link
              href="/tester"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">Tester</p>
              <p className="text-white text-lg font-extrabold leading-tight flex items-center gap-2">
                <Wrench size={16} className="text-amber-400 shrink-0" />
                Texnik muammo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-5 max-w-lg mx-auto">
        {/* Report form */}
        <form onSubmit={submit} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-4">
          {/* Category picker */}
          <div>
            <label className="block text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
              Muammo turi
            </label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_CONFIG.map((c) => {
                const isActive = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-2 rounded-xl border-[1.5px] transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1] hover:bg-[#ede9e1]'
                    }`}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity picker */}
          <div>
            <label className="block text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
              Jiddiyligi
            </label>
            <div className="flex gap-2">
              {SEVERITY_CONFIG.map((s) => {
                const isActive = severity === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSeverity(s.key)}
                    aria-pressed={isActive}
                    className={`flex-1 text-xs font-extrabold py-2.5 rounded-xl border-[1.5px] transition-colors ${
                      isActive ? s.active : s.inactive
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description textarea with char counter */}
          <div>
            <label htmlFor="tech-issue-description" className="block text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
              Tasvirlash
            </label>
            <textarea
              id="tech-issue-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
              rows={4}
              placeholder="Muammoni batafsil tasvirlab bering..."
              aria-label="Muammo tavsifi"
              className="w-full bg-[#f7f4ef] border-[1.5px] border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] resize-none focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a]"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-[11px] font-bold tabular-nums ${description.length >= MAX_DESC ? 'text-rose-500' : 'text-[#94a3b8]'}`}>
                {description.length}/{MAX_DESC}
              </span>
            </div>
          </div>

          {/* Submit button */}
          <Button
            variant="primary"
            fullWidth
            loading={submitting}
            disabled={submitting || !description.trim()}
            icon={<Send size={15} />}
          >
            {submitting ? 'Yuborilmoqda...' : 'Muammoni yuborish'}
          </Button>
        </form>

        {/* History section */}
        <section>
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
            Yuborilganlar tarixi
          </p>

          {/* History filter chips */}
          {!loadingItems && items.length > 0 && (
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
              {historyChips.map((c) => {
                const isActive = historyFilter === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setHistoryFilter(c.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                    }`}
                  >
                    {c.label}
                    <span className={isActive ? 'text-white/80' : 'text-[#94a3b8]'}>{c.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* A5: history load error notice */}
          {historyLoadError && !loadingItems && (
            <div className="bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl px-4 py-3 mb-3">
              <p className="text-rose-700 text-sm font-bold">
                Tarix yuklanmadi. Sahifani yangilang yoki qayta urinib ko&apos;ring.
              </p>
            </div>
          )}

          {loadingItems ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                  <Skeleton theme="light" className="h-4 w-1/2" />
                  <Skeleton theme="light" className="h-3 w-3/4" />
                  <Skeleton theme="light" className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
              <EmptyState
                theme="light"
                icon={<Wrench size={28} />}
                title="Muammolar yo'q"
                description="Siz hali birorta texnik muammo yubormagansiz"
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
              <p className="text-sm font-extrabold text-[#0f172a]">Bu filtrda yozuvlar yo&apos;q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isResolved = item.status === 'resolved';
                const catLabel = CATEGORY_LABEL[item.category as CategoryKey] ?? item.category;
                return (
                  <div key={item.id} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-[#0f172a] truncate">{catLabel}</p>
                        {/* Severity badge */}
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.low}`}>
                          {SEVERITY_LABEL[item.severity] ?? item.severity}
                        </span>
                      </div>
                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 ${
                        isResolved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isResolved ? <CheckCircle size={10} /> : <Clock size={10} />}
                        {isResolved ? 'Bajarildi' : 'Ochiq'}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748b] leading-relaxed">{item.description}</p>
                    <p className="text-[11px] font-bold text-[#94a3b8]">{relativeTime(item.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
