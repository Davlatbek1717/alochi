/* eslint-disable react/no-unescaped-entities */
'use client';
import { useEffect, useState } from 'react';
import { Shield, User, Key, AlertTriangle, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';

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
  default: <AlertTriangle size={14} className="text-[#94a3b8]" />,
};

const ACTION_FILTER_OPTIONS = ['', 'login', 'user.create', 'user.delete', 'role.change'];
const ACTION_FILTER_LABELS: Record<string, string> = {
  '': 'Barcha harakatlar',
  login: 'Kirish',
  'user.create': "Foydalanuvchi yaratish",
  'user.delete': "Foydalanuvchi o'chirish",
  'role.change': "Rol o'zgartirish",
};

const PAGE_SIZE = 50;

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
  const [actionFilter, setActionFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

      <div className="px-4 pt-5 pb-10 max-w-4xl space-y-4">
        {/* Action filter */}
        {!loading && !error && (
          <div className="relative inline-flex items-center">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="appearance-none bg-white border border-[#ede9e1] rounded-xl px-3 py-2 pr-8 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a] font-semibold"
            >
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{ACTION_FILTER_LABELS[opt]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-[#94a3b8] pointer-events-none" />
          </div>
        )}

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
        ) : (() => {
          const filtered = actionFilter
            ? entries.filter((e) => e.action === actionFilter)
            : entries;
          const visible = filtered.slice(0, visibleCount);
          return filtered.length === 0 ? (
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
              <EmptyState
                theme="light"
                icon={<Shield size={28} />}
                title="Audit log bo'sh"
                description="Tizim harakatlari yozila boshlaganda bu yerda ko'rinadi."
              />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#ede9e1] bg-[#fffaf0] flex items-center justify-between">
                  <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-widest">
                    So'nggi harakatlar
                  </h2>
                  <span className="text-xs text-[#94a3b8] font-semibold">{filtered.length} ta yozuv</span>
                </div>
                <ol className="divide-y divide-[#f3eedf]">
                  {visible.map((e) => (
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
              {visibleCount < filtered.length && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="text-sm font-bold text-[#0f172a] bg-white border border-[#ede9e1] hover:bg-[#f7f4ef] px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Ko'proq ko'rsatish ({filtered.length - visibleCount} ta qoldi)
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
