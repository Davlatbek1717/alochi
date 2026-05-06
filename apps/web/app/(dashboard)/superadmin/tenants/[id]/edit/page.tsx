'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Save, ShieldOff, AlertTriangle, Palette } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, useToast, Skeleton } from '@/components/ui';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  brandName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{3,6}$/;

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const toast = useToast();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Branding fields
  const [brandName, setBrandName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest<TenantDetail>(`/tenants/${id}`, {}, token());
        if (!cancelled) {
          setTenant(res.data);
          setName(res.data.name);
          setBrandName(res.data.brandName ?? '');
          setLogoUrl(res.data.logoUrl ?? '');
          setFaviconUrl(res.data.faviconUrl ?? '');
          setPrimaryColor(res.data.primaryColor ?? '');
        }
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
  }, [id]);

  async function onSave() {
    if (!id) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Nom kamida 2 ta belgidan iborat bo’lishi kerak");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        `/tenants/${id}`,
        { method: 'PATCH', body: JSON.stringify({ name: trimmed }) },
        token(),
      );
      toast.success('Markaz nomi yangilandi');
      router.push('/superadmin/tenants');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBranding() {
    if (!id) return;
    setSavingBranding(true);
    try {
      await apiRequest(
        `/tenants/${id}/settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            brandName: brandName.trim() || null,
            logoUrl: logoUrl.trim() || null,
            faviconUrl: faviconUrl.trim() || null,
            primaryColor: primaryColor.trim() || null,
          }),
        },
        token(),
      );
      toast.success('Brending sozlamalari saqlandi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingBranding(false);
    }
  }

  async function onDisable() {
    if (!id) return;
    setDisabling(true);
    try {
      await apiRequest(`/tenants/${id}/disable`, { method: 'POST' }, token());
      toast.success('Markaz bloklandi');
      setConfirmOpen(false);
      router.push('/superadmin/tenants');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/superadmin/tenants')}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
            aria-label="Orqaga"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Building2 size={18} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
              Markazni tahrirlash
            </p>
            <p className="text-white font-bold text-lg">
              {loading ? '…' : tenant?.name ?? 'Topilmadi'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <Skeleton className="h-[180px] rounded-[18px]" theme="light" />
        ) : !tenant ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center text-sm text-[#64748b]">
            Markaz topilmadi.
          </div>
        ) : (
          <>
            {/* Name form */}
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
              <h2 className="font-bold text-[#0f172a] text-base mb-1">Asosiy ma&apos;lumot</h2>
              <p className="text-xs text-[#64748b] mb-4">
                Slug (URL) o&apos;zgartirilmaydi: <span className="font-mono">/{tenant.slug}</span>
              </p>
              <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                Markaz nomi
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full bg-white border border-[#ede9e1] rounded-lg px-3 py-2 text-sm text-[#0f172a] focus:border-violet-500 outline-none"
                placeholder="Markaz nomi"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/superadmin/tenants')}
                  className="bg-[#f7f4ef] text-[#475569] rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || name.trim() === tenant.name}
                  className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={14} />
                  {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                </button>
              </div>
            </div>

            {/* Branding (Whitelabel) */}
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Palette size={16} className="text-violet-600" />
                </div>
                <h2 className="font-bold text-[#0f172a] text-base">Brending (Whitelabel)</h2>
              </div>
              <p className="text-xs text-[#64748b] mb-4">
                Markaz o&apos;z logotipi, rangi va nomini ko&apos;rsatishi uchun sozlamalar.
              </p>

              {/* brandName */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Markaz nomi (brend)
                </label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  maxLength={120}
                  className="w-full bg-white border border-[#ede9e1] rounded-lg px-3 py-2 text-sm text-[#0f172a] focus:border-violet-500 outline-none"
                  placeholder="Masalan: Smart English Academy"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  Login va dashboard&apos;da ko&apos;rinadigan nom. Bo&apos;sh qoldirsa platforma nomi ko&apos;rinadi.
                </p>
              </div>

              {/* logoUrl */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Logo URL
                </label>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  maxLength={500}
                  className="w-full bg-white border border-[#ede9e1] rounded-lg px-3 py-2 text-sm text-[#0f172a] focus:border-violet-500 outline-none"
                  placeholder="https://example.com/logo.svg"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  SVG yoki PNG havola. Dashboard sarlavhasida 32–48px balandlikda ko&apos;rsatiladi.
                </p>
              </div>

              {/* faviconUrl */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Favicon URL
                </label>
                <input
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  maxLength={500}
                  className="w-full bg-white border border-[#ede9e1] rounded-lg px-3 py-2 text-sm text-[#0f172a] focus:border-violet-500 outline-none"
                  placeholder="https://example.com/favicon.ico"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  32×32 PNG yoki .ico havola.
                </p>
              </div>

              {/* primaryColor */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                  Asosiy rang (hex)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    maxLength={7}
                    className="flex-1 bg-white border border-[#ede9e1] rounded-lg px-3 py-2 text-sm text-[#0f172a] focus:border-violet-500 outline-none font-mono"
                    placeholder="#6d28d9"
                  />
                  {HEX_RE.test(primaryColor) && (
                    <div
                      className="w-5 h-5 rounded-md border border-[#ede9e1] shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                  )}
                </div>
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  Hex format: #6d28d9. Bo&apos;sh qoldirsa standart rang ishlatiladi.
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onSaveBranding}
                  disabled={savingBranding}
                  className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={14} />
                  {savingBranding ? 'Saqlanmoqda…' : 'Brendni saqlash'}
                </button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="bg-white rounded-[18px] border-[1.5px] border-rose-200 p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-rose-600" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-rose-700 text-base">Xavfli zona</h2>
                  <p className="text-xs text-[#64748b] mt-1">
                    Markazni bloklash uning barcha foydalanuvchilarini ham nofaol holatga o&apos;tkazadi.
                    Bu amalni qaytarib bo&apos;lmaydi (faqat DBdan qo&apos;lda).
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!tenant.isActive}
                    className="mt-4 bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShieldOff size={14} />
                    {tenant.isActive ? 'Markazni bloklash' : 'Allaqachon bloklangan'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => (disabling ? null : setConfirmOpen(false))}
        title="Markazni bloklash"
        description={`"${tenant?.name ?? ''}" markazi va uning barcha foydalanuvchilari nofaol bo'ladi.`}
        size="sm"
        theme="dark"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={disabling}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={onDisable}
              disabled={disabling}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <ShieldOff size={14} />
              {disabling ? 'Bloklanmoqda…' : 'Ha, bloklash'}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          Davom etishni tasdiqlaysizmi? Bu amal foydalanuvchilarning kirishini darhol to&apos;xtatadi.
        </p>
      </Modal>
    </div>
  );
}
