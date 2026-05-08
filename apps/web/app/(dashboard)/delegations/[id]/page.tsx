'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, Calendar, Shield, FileText, CheckCircle, XCircle, AlertTriangle, CreditCard, Users, Clock, Printer } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';
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
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');

    async function fetchAll() {
      try {
        const [delRes, auditRes] = await Promise.allSettled([
          apiRequest<Delegation>(`/delegations/${id}`),
          apiRequest<AuditLogEntry[]>(`/delegations/${id}/audit`),
        ]);
        if (delRes.status === 'fulfilled') {
          setDelegation(delRes.value.data);
        } else {
          const err = delRes.reason as Error;
          setLoadError(err?.message ?? 'Yuklanmadi');
        }
        if (auditRes.status === 'fulfilled') setAudit(auditRes.value.data);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [id]);

  // Browser-native print → save as PDF. The page itself has print
  // styles that hide chrome (TopNav, action buttons) and emit a clean
  // single-page audit record. Beats bundling jsPDF for a feature
  // that's used a few times a month.
  const handleExportPdf = useCallback(() => {
    // Set a friendlier filename for the print dialog. Browsers use
    // document.title as the default download name. Restore it after
    // a short timeout so the title doesn't stick if the user cancels.
    const original = document.title;
    if (delegation) {
      const safe = `delegatsiya-${delegation.fromUser.name}-${formatDate(delegation.startsAt)}`
        .replace(/[^\wЀ-ӿ-]+/g, '_');
      document.title = safe;
    }
    setTimeout(() => {
      window.print();
      document.title = original;
    }, 50);
  }, [delegation]);

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        {/* Header skeleton */}
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <div className="h-5 w-24 bg-white/10 rounded-lg animate-pulse mb-4" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
            <div className="h-6 w-48 bg-white/10 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Card skeletons */}
        <div className="px-4 pt-5 pb-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Not found / error state
  if (!delegation) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <p className="text-white font-bold text-lg">Delegatsiya</p>
        </div>
        <div className="px-4 pt-5 space-y-3">
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border-2 border-rose-100 flex items-center justify-center mx-auto">
              <XCircle size={28} className="text-rose-500" />
            </div>
            <div>
              <p className="font-bold text-[#0f172a]">Delegatsiya topilmadi</p>
              {loadError && <p className="text-sm text-[#64748b] mt-1">{loadError}</p>}
            </div>
            <button
              onClick={() => router.push('/delegations')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-4 py-2.5 rounded-xl hover:bg-[#ede9e1] transition-colors focus:outline-none focus:ring-2 focus:ring-[#6d28d9] focus:ring-offset-2"
            >
              <ArrowLeft size={14} /> Delegatsiyalarga qaytish
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status = delegation?.status ?? 'pending';
  const statusCfg = STATUS_CONFIG[status] ?? { label: status, className: 'bg-white/10 text-white border-white/20' };

  return (
    <div className="min-h-full bg-[#f7f4ef] print:bg-white">
      {/* Print-only styles — collapse the dashboard chrome (TopNav,
          dark header, sticky elements) and render a clean white-paper
          audit record. Tailwind ships a `print:` variant for the
          modifier; everything else inherits the screen layout. */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 16mm 14mm; }
          body { background: #fff !important; }
          /* Hide the global top navigation */
          nav[aria-label="Asosiy navigatsiya"] { display: none !important; }
          /* Hide notification bell + tester banner anything in the
             outer dashboard layout that floats above content */
          header, .no-print { display: none !important; }
          /* Make cards borderless on paper */
          .bg-white { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden print:bg-white print:text-[#0f172a] print:px-0 print:pt-0 print:pb-4 print:border-b print:border-[#ede9e1]">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 print:hidden"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm print:hidden">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 print:bg-indigo-100">
                <GitBranch size={18} className="text-indigo-400 print:text-indigo-700" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-tight print:text-[#0f172a]">
                  {delegation ? `${delegation.fromUser.name} → ${delegation.toUser.name}` : 'Delegatsiya'}
                </p>
                {delegation && (
                  <p className="text-[#94a3b8] text-xs mt-0.5 print:text-[#64748b]">
                    {formatDate(delegation.startsAt)} – {formatDate(delegation.endsAt)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportPdf}
                disabled={!delegation}
                className="hidden sm:inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors print:hidden"
              >
                <Printer size={12} /> PDF eksport
              </button>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.className} print:bg-white print:text-[#0f172a] print:border-[#ede9e1]`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
          {/* Mobile-friendly export button — full-width below the
              header row when the inline one wraps off-screen. */}
          <button
            onClick={handleExportPdf}
            disabled={!delegation}
            className="sm:hidden mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white border border-white/20 px-3 py-2 rounded-xl text-xs font-bold transition-colors print:hidden"
          >
            <Printer size={12} /> PDF eksport
          </button>
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
