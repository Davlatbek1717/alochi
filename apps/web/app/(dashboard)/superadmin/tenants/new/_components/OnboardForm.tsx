'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, RefreshCw, User, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { CredentialsModal } from './CredentialsModal';

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
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
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalData | null>(null);

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
    setError('');
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
        }),
      }, token);
      setModal({
        tenantSlug: r.data.tenant.slug,
        login: r.data.admin.login,
        password: adminPassword,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server xatosi';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        {error && (
          <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Building2 size={16} className="text-emerald-400" />
            Markaz ma&apos;lumotlari
          </h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Markaz nomi *</label>
            <input
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
            <label className="block text-xs text-slate-400 mb-1.5">Slug *</label>
            <input
              type="text"
              required
              pattern="[a-z0-9-]{3,50}"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-emerald-500 outline-none"
              placeholder="toshkent-ielts"
            />
            <p className="text-xs text-slate-500 mt-1">URL: /{slug || 'slug'}/login</p>
          </div>
        </section>

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <User size={16} className="text-blue-400" />
            Birinchi admin (filadmin)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Ism *</label>
              <input
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
              <label className="block text-xs text-slate-400 mb-1.5">Login *</label>
              <input
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
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock size={12} /> Parol *
            </label>
            <div className="flex gap-2">
              <input
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
              <button
                type="button"
                onClick={() => setAdminPassword(generatePassword())}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Generate
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefon (ixtiyoriy)</label>
            <input
              type="text"
              maxLength={20}
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="+998 90 123 45 67"
            />
          </div>
        </section>

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
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
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Filial nomi *</label>
              <input
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
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/superadmin')}
            className="px-5 py-2 text-sm text-slate-400 hover:text-white"
          >
            Bekor
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm"
          >
            {submitting ? 'Yaratilmoqda...' : 'Markaz Yaratish'}
          </button>
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
