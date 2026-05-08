'use client';
import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, useToast } from '@/components/ui';
import { getTenantIdFromToken } from '@/lib/jwt';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  warningBlockLimit: number;
}

export default function SuperadminSettingsPage() {
  const toast = useToast();
  const [tenant, setTenant] = useState<TenantSettings | null>(null);
  const [warningBlockLimit, setWarningBlockLimit] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tenantId = getTenantIdFromToken();
    if (!tenantId) {
      setError('Tenant topilmadi');
      setLoading(false);
      return;
    }
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<TenantSettings>(`/tenants/${tenantId}`, {}, token)
      .then((res) => {
        setTenant(res.data);
        setWarningBlockLimit(res.data.warningBlockLimit ?? 3);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!tenant) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<TenantSettings>(
        `/tenants/${tenant.id}/settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ warningBlockLimit }),
        },
        token,
      );
      setTenant(res.data);
      toast.success('Sozlamalar saqlandi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Settings size={18} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
              Superadmin
            </p>
            <p className="text-white font-bold text-lg">Sozlamalar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {loading ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 space-y-3">
            <Skeleton theme="light" className="h-4 w-24" />
            <Skeleton theme="light" className="h-6 w-48" />
            <Skeleton theme="light" className="h-4 w-32" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6">
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        ) : tenant ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1">
                Markaz
              </p>
              <p className="text-[#0f172a] font-semibold text-base">
                {tenant.name}
              </p>
              <p className="text-[#94a3b8] text-xs">{tenant.slug}</p>
            </div>

            <div className="border-t border-[#ede9e1] pt-4">
              <label
                className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2"
                htmlFor="warningBlockLimit"
              >
                Bloklash chegarasi (ogohlantirishlar)
              </label>
              <p className="text-xs text-[#64748b] mb-3">
                Necha faol ogohlantirishdan keyin o&apos;quvchi avtomatik
                bloklansin? (1-10)
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="warningBlockLimit"
                  type="number"
                  min={1}
                  max={10}
                  value={warningBlockLimit}
                  onChange={(e) =>
                    setWarningBlockLimit(
                      Math.max(1, Math.min(10, Number(e.target.value))),
                    )
                  }
                  className="w-24 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm text-center focus:outline-none focus:border-[#0f172a]"
                />
                <span className="text-xs text-[#94a3b8]">
                  Hozirgi: {tenant.warningBlockLimit ?? 3}
                </span>
              </div>
            </div>

            <button
              onClick={save}
              disabled={
                saving ||
                warningBlockLimit === (tenant.warningBlockLimit ?? 3)
              }
              className="bg-[#0f172a] text-white px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Saqlash
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
