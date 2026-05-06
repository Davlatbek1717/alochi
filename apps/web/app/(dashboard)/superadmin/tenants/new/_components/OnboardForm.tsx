'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, RefreshCw, User, Lock, Inbox } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Card, CardHeader, CardTitle, CardDescription, useToast } from '@/components/ui';
import { CredentialsModal } from './CredentialsModal';

interface ContactRequestPrefill {
  id: string;
  centerName: string;
  contactName: string;
  phone: string;
  email: string | null;
}

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generatePassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

interface OnboardResponse {
  tenant: { id: string; name: string; slug: string };
  admin: { id: string; name: string; login: string };
  branch: { id: string; name: string } | null;
}

interface ModalData {
  tenantSlug: string;
  login: string;
  password: string;
}

export function OnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const prefillId = searchParams.get('prefill');
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [includeBranch, setIncludeBranch] = useState(false);
  const [branchName, setBranchName] = useState('Markaziy filial');
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalData | null>(null);
  const [prefillSource, setPrefillSource] =
    useState<ContactRequestPrefill | null>(null);

  useEffect(() => {
    if (!prefillId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest<ContactRequestPrefill>(
          `/contact-requests/${prefillId}`,
          {},
          token,
        );
        if (cancelled) return;
        const r = res.data;
        setPrefillSource(r);
        setTenantName(r.centerName);
        setSlug(deriveSlug(r.centerName));
        setAdminName(r.contactName);
        setAdminPhone(r.phone);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? `Demo so'rovi yuklanmadi: ${err.message}`
              : "Demo so'rovi yuklanmadi",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId]);

  function onTenantNameChange(value: string) {
    setTenantName(value);
    if (!slugTouched) setSlug(deriveSlug(value));
  }

  function onSlugChange(value: string) {
    setSlug(value);
    setSlugTouched(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const r = await apiRequest<OnboardResponse>('/tenants/onboard', {
        method: 'POST',
        body: JSON.stringify({
          tenant: { name: tenantName, slug },
          admin: {
            name: adminName,
            login: adminLogin,
            password: adminPassword,
            ...(adminPhone ? { phone: adminPhone } : {}),
          },
          ...(includeBranch ? { branch: { name: branchName } } : {}),
          ...(prefillSource ? { contactRequestId: prefillSource.id } : {}),
        }),
      }, token);
      if (prefillSource) {
        toast.success(
          "Markaz yaratildi va so'rov 'Konvertatsiya qilindi' ga o'tkazildi",
        );
      }
      setModal({
        tenantSlug: r.data.tenant.slug,
        login: r.data.admin.login,
        password: adminPassword,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server xatosi';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        {prefillSource && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 flex items-start gap-3">
            <Inbox size={18} className="text-violet-300 mt-0.5 shrink-0" />
            <div className="text-sm text-violet-100 flex-1 min-w-0">
              <p className="font-bold">
                Demo so&apos;rovidan ma&apos;lumotlar to&apos;ldirildi
              </p>
              <p className="text-violet-200/80 text-xs mt-0.5 truncate">
                Manba: {prefillSource.centerName} ({prefillSource.contactName})
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/superadmin/contact-requests')}
              className="text-xs font-bold text-violet-200 hover:text-white underline shrink-0"
            >
              So&apos;rovlar
            </button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Building2 size={16} className="text-emerald-400" />
                Markaz ma&apos;lumotlari
              </span>
            </CardTitle>
            <CardDescription>Tenant nomi va URL slug</CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <label htmlFor="tenant-name" className="block text-xs text-slate-400 mb-1.5">Markaz nomi *</label>
              <input
                id="tenant-name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={tenantName}
                onChange={(e) => onTenantNameChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
                placeholder="Toshkent IELTS Markazi"
              />
            </div>
            <div>
              <label htmlFor="tenant-slug" className="block text-xs text-slate-400 mb-1.5">Slug *</label>
              <input
                id="tenant-slug"
                type="text"
                required
                pattern="[a-z0-9\-]{3,50}"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-emerald-500 outline-none"
                placeholder="toshkent-ielts"
              />
              <p className="text-xs text-slate-500 mt-1">URL: adouptivo.com/{slug || 'slug'}/login</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <User size={16} className="text-blue-400" />
                Birinchi admin (filadmin)
              </span>
            </CardTitle>
            <CardDescription>Markaz administratorining kirish ma&apos;lumotlari</CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-name" className="block text-xs text-slate-400 mb-1.5">Ism *</label>
                <input
                  id="admin-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="admin-login" className="block text-xs text-slate-400 mb-1.5">Login *</label>
                <input
                  id="admin-login"
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_.\-]+"
                  value={adminLogin}
                  onChange={(e) => setAdminLogin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Lock size={12} /> Parol *
              </label>
              <div className="flex gap-2">
                <input
                  id="admin-password"
                  type="text"
                  required
                  minLength={6}
                  maxLength={100}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={12} />}
                  onClick={() => setAdminPassword(generatePassword())}
                >
                  Generate
                </Button>
              </div>
            </div>
            <div>
              <label htmlFor="admin-phone" className="block text-xs text-slate-400 mb-1.5">Telefon (ixtiyoriy)</label>
              <input
                id="admin-phone"
                type="text"
                maxLength={20}
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                placeholder="+998 90 123 45 67"
              />
            </div>
          </div>
        </Card>

        <Card>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBranch}
              onChange={(e) => setIncludeBranch(e.target.checked)}
              className="w-4 h-4"
            />
            Birinchi filial ham yaratish (ixtiyoriy)
          </label>
          {includeBranch && (
            <div className="mt-4">
              <label htmlFor="branch-name" className="block text-xs text-slate-400 mb-1.5">Filial nomi *</label>
              <input
                id="branch-name"
                type="text"
                required={includeBranch}
                minLength={2}
                maxLength={100}
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/superadmin')}
          >
            Bekor
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
          >
            {submitting ? 'Yaratilmoqda...' : 'Markaz Yaratish'}
          </Button>
        </div>
      </form>

      {modal && <CredentialsModal data={modal} onClose={handleClose} />}
    </>
  );

  function handleClose() {
    setAdminPassword('');
    setModal(null);
    router.push('/superadmin');
  }
}
