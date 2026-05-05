/* eslint-disable react/no-unescaped-entities */
'use client';
import { useEffect, useState } from 'react';
import { Shield, User, Building2, Key, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  tenantId: string | null;
  action: string;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  login: <Key size={14} className="text-[#10b981]" />,
  'user.create': <User size={14} className="text-[#6d28d9]" />,
  'user.delete': <User size={14} className="text-rose-500" />,
  'role.change': <Shield size={14} className="text-[#f97316]" />,
  'tenant.create': <Building2 size={14} className="text-[#1cb0f6]" />,
  default: <AlertTriangle size={14} className="text-[#94a3b8]" />,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function getToken() {
  return typeof window !== 'undefined'
    ? (localStorage.getItem('accessToken') ?? '') : '';
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    apiRequest<AuditEntry[]>('/audit-log', {}, token)
      .then((r) => setEntries(r.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Yuklanmadi'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%,-30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Shield size={18} className="text-emerald-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
            <p className="text-white font-bold text-lg">Xavfsizlik Audit Logi</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-10 max-w-4xl">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <Skeleton key={i} theme="light" className="h-16 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-8 text-center">
            <Shield size={40} className="mx-auto text-[#94a3b8] mb-3" />
            <p className="text-[#0f172a] font-bold">Audit log bo'sh</p>
            <p className="text-[#64748b] text-sm mt-1">
              Tizim harakatlari yozila boshlaganda bu yerda ko'rinadi.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#ede9e1] bg-[#fffaf0] flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-widest">
                So'nggi harakatlar
              </h2>
              <span className="text-xs text-[#94a3b8] font-semibold">{entries.length} ta yozuv</span>
            </div>
            <ol className="divide-y divide-[#f3eedf]">
              {entries.map((e) => (
                <li key={e.id} className="px-5 py-3 flex items-start gap-3 hover:bg-[#fffaf0] transition-colors">
                  <span className="mt-0.5 shrink-0">
                    {ACTION_ICONS[e.action] ?? ACTION_ICONS.default}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-[#0f172a]">{e.action}</span>
                      {e.actorRole && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6d28d9]/10 text-[#6d28d9] uppercase tracking-wider">
                          {e.actorRole}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-[#94a3b8] font-semibold">
                      {e.actorId && <span>Actor: {e.actorId.slice(0,8)}…</span>}
                      {e.targetId && <span>Target: {e.targetId.slice(0,16)}…</span>}
                      {e.ipAddress && <span>IP: {e.ipAddress}</span>}
                      <span>{formatDate(e.createdAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
