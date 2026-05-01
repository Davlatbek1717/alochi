'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Plus,
  Circle,
  Clock,
  CheckCircle,
  XCircle,
  Ban,
  ChevronRight,
  X as XIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, useToast } from '@/components/ui';
import { formatDateShort } from '@/lib/date-uz';

type DelegationStatus =
  | 'active'
  | 'pending'
  | 'completed'
  | 'rejected'
  | 'cancelled';

type ApiDelegation = {
  id: string;
  status: DelegationStatus;
  fromUser: { name: string };
  toUser: { name: string };
  delegatedRole: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  permissions?: string[];
};

type Delegation = {
  id: string;
  status: DelegationStatus;
  from: string;
  to: string;
  role: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  permissions: string[];
};

const STATUS_CONFIG: Record<
  DelegationStatus,
  { icon: React.ReactNode; badge: string; label: string }
> = {
  active: {
    icon: <Circle size={10} className="fill-emerald-500 text-emerald-500" />,
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    label: 'Faol',
  },
  pending: {
    icon: <Clock size={10} className="text-amber-500" />,
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    label: 'Kutilmoqda',
  },
  completed: {
    icon: <CheckCircle size={10} className="text-blue-500" />,
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    label: 'Tugadi',
  },
  rejected: {
    icon: <XCircle size={10} className="text-rose-500" />,
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
    label: 'Rad etildi',
  },
  cancelled: {
    icon: <Ban size={10} className="text-[#94a3b8]" />,
    badge: 'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]',
    label: 'Bekor qilindi',
  },
};

function formatDate(isoDate: string): string {
  try {
    return formatDateShort(isoDate);
  } catch {
    return isoDate;
  }
}

export default function DelegationsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<DelegationStatus | 'all'>('all');
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<Delegation | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  function load() {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    apiRequest<ApiDelegation[]>('/delegations', {}, token)
      .then((res) => {
        setDelegations(
          res.data.map((d) => ({
            id: d.id,
            status: d.status,
            from: d.fromUser.name,
            to: d.toUser.name,
            role: d.delegatedRole,
            startsAt: formatDate(d.startsAt),
            endsAt: formatDate(d.endsAt),
            reason: d.reason,
            permissions: d.permissions ?? [],
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function doCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error('Bekor qilish sababi majburiy');
      return;
    }
    setCancelling(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        `/delegations/${cancelTarget.id}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ reason: cancelReason.trim() }),
        },
        token,
      );
      toast.success('Delegatsiya bekor qilindi');
      setCancelTarget(null);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setCancelling(false);
    }
  }

  const filtered =
    activeTab === 'all'
      ? delegations
      : delegations.filter((d) => d.status === activeTab);
  const tabs = (['all', 'active', 'pending', 'completed', 'rejected'] as const);

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
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">
              Manager
            </p>
            <p className="text-white text-xl font-bold">Delegatsiyalar</p>
          </div>
          <Link
            href="/delegations/new"
            className="flex items-center gap-1.5 bg-[#0d9488] text-white px-4 py-2.5 rounded-xl text-sm font-bold"
          >
            <Plus size={16} /> Yangi
          </Link>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {!loading && delegations.length > 0 && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
            <p className="text-sm font-semibold text-[#0f172a]">
              {delegations.length} ta delegatsiya,{' '}
              {delegations.reduce(
                (sum, d) => sum + d.permissions.length,
                0,
              )}{' '}
              ta amal
            </p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-[#64748b] border border-[#ede9e1]'
              }`}
            >
              {tab === 'all' ? 'Barchasi' : STATUS_CONFIG[tab]?.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-[3px] border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center">
            <p className="text-[#64748b] text-sm">Delegatsiya topilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => {
              const s = STATUS_CONFIG[d.status];
              const canCancel =
                d.status === 'active' || d.status === 'pending';
              return (
                <div
                  key={d.id}
                  className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${s.badge}`}
                        >
                          {s.icon} {s.label}
                        </span>
                        <span className="text-xs text-[#64748b] bg-[#f7f4ef] px-2 py-0.5 rounded-full">
                          {d.role}
                        </span>
                      </div>
                      <p className="font-semibold text-[#0f172a] text-sm">
                        {d.from} → {d.to}
                      </p>
                      <p className="text-xs text-[#94a3b8]">
                        {d.startsAt} – {d.endsAt}
                      </p>
                      <p className="text-xs text-[#64748b] italic">
                        &quot;{d.reason}&quot;
                      </p>
                    </div>
                    <Link
                      href={`/delegations/${d.id}`}
                      className="shrink-0 w-8 h-8 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a]"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => setCancelTarget(d)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200"
                    >
                      <XIcon size={12} /> Bekor qilish
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Delegatsiyani bekor qilish"
        theme="light"
      >
        <p className="text-sm text-[#64748b] mb-3">
          <span className="font-semibold text-[#0f172a]">
            {cancelTarget?.from} → {cancelTarget?.to}
          </span>{' '}
          delegatsiyasi bekor qilinsinmi? Bekor qilish sababini kiriting.
        </p>
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Sababi (majburiy)"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setCancelTarget(null)}
            disabled={cancelling}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Yo‘q
          </button>
          <button
            onClick={doCancel}
            disabled={cancelling || !cancelReason.trim()}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {cancelling ? 'Saqlanmoqda...' : 'Ha, bekor qil'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
