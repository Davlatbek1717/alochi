'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Pencil, ShieldOff, Users as UsersIcon } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { formatDateShort } from '@/lib/date-uz';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { users: number; branches: number };
}

function formatDate(iso: string) {
  try {
    return formatDateShort(iso);
  } catch {
    return iso;
  }
}

export default function SuperadminTenantsPage() {
  const router = useRouter();
  const toast = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<TenantRow[]>('/tenants', {}, token());
        if (!cancelled) setTenants(res.data);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Xatolik');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <Building2 size={18} className="text-violet-300" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                Superadmin
              </p>
              <p className="text-white font-bold text-lg">Markazlar</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/superadmin/tenants/new')}
            className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1.5"
          >
            <Plus size={15} />
            Yangi
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[72px] rounded-[14px]" theme="light" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Building2 size={28} />}
              title="Markazlar yo'q"
              description="Birinchi markazni yarating"
              theme="light"
            />
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="space-y-2 md:hidden">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] px-4 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0f172a] text-sm truncate">{t.name}</p>
                      <p className="font-mono text-[#64748b] text-xs truncate">/{t.slug}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-2 py-1 font-semibold">
                      <UsersIcon size={11} />
                      {t._count.users} foyd.
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2 py-1 font-semibold">
                      <Building2 size={11} />
                      {t._count.branches} fil.
                    </span>
                    <span className="ml-auto text-[#94a3b8] font-mono">
                      {formatDate(t.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/superadmin/tenants/${t.id}/edit`)}
                      aria-label={`${t.name} ni tahrirlash`}
                      className="flex-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Pencil size={13} />
                      Tahrirlash
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/superadmin/tenants/${t.id}/edit`)}
                      aria-label={`${t.name} ni bloklash`}
                      className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <ShieldOff size={13} />
                      Bloklash
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / tablet: table */}
            <div className="hidden md:block bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#f7f4ef]">
                    <tr className="border-b border-[#ede9e1]">
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Slug
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Nomi
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Foydalanuvchilar
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Filiallar
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Yaratilgan
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-right text-[10px] font-semibold text-[#64748b] uppercase tracking-wider"
                      >
                        Amallar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t, idx) => (
                      <tr
                        key={t.id}
                        className={`border-b border-[#ede9e1] last:border-0 ${
                          idx % 2 === 1 ? 'bg-[#fbf9f5]' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#475569]">/{t.slug}</td>
                        <td className="px-4 py-3 font-bold text-[#0f172a]">{t.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-[#0f172a]">
                          {t._count.users}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#0f172a]">
                          {t._count.branches}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#64748b]">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => router.push(`/superadmin/tenants/${t.id}/edit`)}
                              aria-label={`${t.name} ni tahrirlash`}
                              className="bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1"
                            >
                              <Pencil size={12} />
                              Tahrir
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/superadmin/tenants/${t.id}/edit`)}
                              aria-label={`${t.name} ni bloklash`}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1"
                            >
                              <ShieldOff size={12} />
                              Blok
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
