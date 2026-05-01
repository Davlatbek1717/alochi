'use client';
import { useEffect, useMemo, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { RequestCard } from './_components/RequestCard';
import type {
  ContactRequest,
  ContactRequestStatus,
} from './_components/RequestCard';
import { DetailModal } from './_components/DetailModal';

interface ListEnvelope {
  items: ContactRequest[];
  counts: Record<ContactRequestStatus, number> & { total: number };
}

const TABS: Array<{ key: 'all' | ContactRequestStatus; label: string }> = [
  { key: 'all', label: 'Hammasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'contacted', label: "Bog'lanildi" },
  { key: 'demo_completed', label: "Demo o'tdi" },
  { key: 'converted', label: 'Konvertatsiya' },
  { key: 'declined', label: 'Rad etilgan' },
];

const ZERO_COUNTS: Record<ContactRequestStatus, number> & { total: number } = {
  new: 0,
  contacted: 0,
  demo_scheduled: 0,
  demo_completed: 0,
  converted: 0,
  declined: 0,
  total: 0,
};

export default function SuperadminContactRequestsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'all' | ContactRequestStatus>('all');
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [counts, setCounts] = useState<typeof ZERO_COUNTS>(ZERO_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<ContactRequest | null>(null);

  const token = () => localStorage.getItem('accessToken') ?? '';

  async function fetchList(activeTab: typeof tab, mode: 'load' | 'refresh') {
    if (mode === 'load') setLoading(true);
    else setRefreshing(true);
    try {
      const path =
        activeTab === 'all'
          ? '/contact-requests'
          : `/contact-requests?status=${activeTab}`;
      const res = await apiRequest<ListEnvelope>(path, {}, token());
      setItems(res.data.items);
      setCounts(res.data.counts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchList(tab, 'load');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const stats = useMemo(
    () => [
      { label: 'Yangi', value: counts.new, color: 'text-violet-400' },
      { label: "Bog'lanildi", value: counts.contacted, color: 'text-blue-400' },
      { label: "Demo", value: counts.demo_completed, color: 'text-emerald-400' },
      { label: 'Konvert.', value: counts.converted, color: 'text-teal-400' },
    ],
    [counts],
  );

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Inbox size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                Superadmin
              </p>
              <p className="text-white font-bold text-lg">Demo so&apos;rovlar</p>
            </div>
          </div>
          <button
            onClick={() => void fetchList(tab, 'refresh')}
            disabled={refreshing}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw
              size={14}
              className={refreshing ? 'animate-spin' : ''}
            />
            Yangilash
          </button>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-2 relative z-10 mt-5">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#162032] rounded-[14px] p-3">
              <p className={`text-xl font-black font-mono ${s.color}`}>
                {s.value}
              </p>
              <p className="text-[#94a3b8] text-[10px] mt-0.5 leading-tight">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count =
              t.key === 'all'
                ? counts.total
                : (counts[t.key as ContactRequestStatus] ?? 0);
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold border-2 transition-all ${
                  active
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-white border-[#ede9e1] text-[#1e1b4b] hover:border-violet-300'
                }`}
              >
                {t.label}{' '}
                <span
                  className={`ml-1 ${active ? 'text-violet-100' : 'text-[#94a3b8]'}`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-[88px] rounded-[18px]"
                theme="light"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Inbox size={28} />}
              title="So'rovlar yo'q"
              description={
                tab === 'all'
                  ? "Hozircha demo so'rovlari kelmagan"
                  : "Bu filtr uchun so'rovlar yo'q"
              }
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((req) => (
              <RequestCard key={req.id} req={req} onOpen={() => setSelected(req)} />
            ))}
          </div>
        )}
      </div>

      <DetailModal
        open={selected !== null}
        request={selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setSelected(updated);
          setItems((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          );
          // Refresh counts since status may have changed
          void fetchList(tab, 'refresh');
        }}
      />
    </div>
  );
}
