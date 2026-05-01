'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, Calendar, Shield, FileText, CheckCircle, XCircle, AlertTriangle, CreditCard, Users, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateShort, formatDateTime } from '@/lib/date-uz';

type Delegation = {
  id: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  status: string;
  delegatedRole: string;
  permissions: string[];
  fromUser: { name: string };
  toUser: { name: string };
};

type AuditLogEntry = {
  id: string;
  action: string;
  actor: string;
  detail?: string;
  createdAt: string;
};

const PERMISSION_LABELS: Record<string, string> = {
  warnings: 'Ogohlantirishlar',
  payments: "To'lovlar",
  users: 'Xodimlar',
  tasks: 'Vazifalar',
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  created:   <FileText size={14} className="text-indigo-400" />,
  accepted:  <CheckCircle size={14} className="text-emerald-400" />,
  rejected:  <XCircle size={14} className="text-rose-400" />,
  cancelled: <XCircle size={14} className="text-rose-400" />,
  warning:   <AlertTriangle size={14} className="text-amber-400" />,
  payment:   <CreditCard size={14} className="text-blue-400" />,
  users:     <Users size={14} className="text-violet-400" />,
};

function getActionIcon(action: string): React.ReactNode {
  const key = Object.keys(ACTION_ICON).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_ICON[key] : <Clock size={14} className="text-[#94a3b8]" />;
}

function formatDate(iso: string): string {
  try {
    return formatDateShort(iso);
  } catch { return iso; }
}

function formatTime(iso: string): string {
  try {
    return formatDateTime(iso);
  } catch { return iso; }
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:    { label: 'Faol', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  pending:   { label: 'Kutilmoqda', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  completed: { label: 'Tugagan', className: 'bg-[#94a3b8]/20 text-[#94a3b8] border-[#94a3b8]/30' },
  rejected:  { label: 'Rad etilgan', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  cancelled: { label: 'Bekor qilingan', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};

export default function DelegationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchAll() {
      try {
        const [delRes, auditRes] = await Promise.allSettled([
          apiRequest<Delegation>(`/delegations/${id}`, {}, token),
          apiRequest<AuditLogEntry[]>(`/delegations/${id}/audit`, {}, token),
        ]);
        if (delRes.status === 'fulfilled') setDelegation(delRes.value.data);
        if (auditRes.status === 'fulfilled') setAudit(auditRes.value.data);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin" />
      </div>
    );
  }

  const status = delegation?.status ?? 'pending';
  const statusCfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-white/10 text-white border-white/20' };

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <GitBranch size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight">
                  {delegation ? `${delegation.fromUser.name} → ${delegation.toUser.name}` : 'Delegatsiya'}
                </p>
                {delegation && (
                  <p className="text-[#94a3b8] text-xs mt-0.5">
                    {formatDate(delegation.startsAt)} – {formatDate(delegation.endsAt)}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-4">
        {/* Info card */}
        {delegation && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#f7f4ef] flex items-center justify-center">
                <Shield size={14} className="text-indigo-500" />
              </div>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Ma&apos;lumot</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-[#94a3b8] w-24 shrink-0">Sabab:</span>
                <span className="text-[#0f172a] font-medium">{delegation.reason}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#94a3b8] w-24 shrink-0">Rol:</span>
                <span className="text-[#0f172a] font-medium capitalize">{delegation.delegatedRole}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#94a3b8] w-24 shrink-0">Ruxsatlar:</span>
                <div className="flex flex-wrap gap-1.5">
                  {delegation.permissions.map((p) => (
                    <span key={p} className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full border border-indigo-100">
                      {PERMISSION_LABELS[p] ?? p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dates */}
        {delegation && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#f7f4ef] flex items-center justify-center">
                <Calendar size={14} className="text-amber-500" />
              </div>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Muddat</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f7f4ef] rounded-xl p-3">
                <p className="text-xs text-[#94a3b8] mb-1">Boshlanish</p>
                <p className="text-sm font-semibold text-[#0f172a]">{formatDate(delegation.startsAt)}</p>
              </div>
              <div className="bg-[#f7f4ef] rounded-xl p-3">
                <p className="text-xs text-[#94a3b8] mb-1">Tugash</p>
                <p className="text-sm font-semibold text-[#0f172a]">{formatDate(delegation.endsAt)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Audit timeline */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#f7f4ef] flex items-center justify-center">
              <Clock size={14} className="text-[#0d9488]" />
            </div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Tarix</p>
          </div>

          {audit.length === 0 ? (
            <p className="text-center text-[#94a3b8] text-sm py-6">Voqealar topilmadi</p>
          ) : (
            <div className="space-y-0 divide-y divide-[#f1ede7]">
              {audit.map((entry) => (
                <div key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-6 h-6 rounded-lg bg-[#f7f4ef] flex items-center justify-center shrink-0 mt-0.5">
                    {getActionIcon(entry.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#94a3b8]">{formatTime(entry.createdAt)}</p>
                    <p className="text-sm font-semibold text-[#0f172a] mt-0.5">{entry.actor} — {entry.action}</p>
                    {entry.detail && (
                      <p className="text-xs text-[#64748b] mt-0.5">{entry.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
