/* eslint-disable react/no-unescaped-entities */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, Check, Building2, User, ClipboardList } from 'lucide-react';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type Step = 1 | 2 | 3;

interface FormData {
  tenantName: string;
  slug: string;
  adminName: string;
  adminLogin: string;
  adminPassword: string;
  adminPhone: string;
  branchName: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function ProgressBar({ step, labels }: { step: Step; labels: [string, string, string] }) {
  const steps = [
    { num: 1, label: labels[0], icon: Building2 },
    { num: 2, label: labels[1], icon: User },
    { num: 3, label: labels[2], icon: ClipboardList },
  ] as const;

  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const active = step === s.num;
        const done = step > s.num;
        return (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm transition-all',
                  done
                    ? 'bg-[#10b981] text-white shadow-[0_4px_0_0_#059669]'
                    : active
                    ? 'bg-[#6d28d9] text-white shadow-[0_4px_0_0_#4c1d95]'
                    : 'bg-[#e8e0d0] text-[#94a3b8]',
                ].join(' ')}
              >
                {done ? <Check size={18} strokeWidth={3} /> : <Icon size={16} />}
              </div>
              <span
                className={[
                  'mt-1 text-[11px] font-bold uppercase tracking-wider',
                  active ? 'text-[#6d28d9]' : done ? 'text-[#10b981]' : 'text-[#94a3b8]',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all',
                  step > s.num ? 'bg-[#10b981]' : 'bg-[#e8e0d0]',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function InputField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  required,
  pattern,
  minLength,
  maxLength,
  placeholder,
  hint,
  error,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-extrabold text-[#1e1b4b] mb-1.5">
        {label} {required && <span className="text-[#ef4444]">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        pattern={pattern}
        minLength={minLength}
        maxLength={maxLength}
        placeholder={placeholder}
        className={[
          'w-full px-4 py-3 rounded-xl border-2 font-semibold text-[#1e1b4b] bg-white placeholder:text-[#94a3b8] outline-none transition-all',
          'focus:border-[#6d28d9] focus:ring-2 focus:ring-[#6d28d9]/20',
          error ? 'border-[#ef4444]' : 'border-[#e8e0d0]',
        ].join(' ')}
      />
      {hint && !error && <p className="mt-1 text-xs text-[#64748b] font-semibold">{hint}</p>}
      {error && <p className="mt-1 text-xs text-[#ef4444] font-semibold">{error}</p>}
    </div>
  );
}

export default function RegisterPage() {
    const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    tenantName: '',
    slug: '',
    adminName: '',
    adminLogin: '',
    adminPassword: '',
    adminPhone: '',
    branchName: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);
  const [registeredSlug, setRegisteredSlug] = useState('');

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleNameChange(name: string) {
    setField('tenantName', name);
    if (!slugEdited) {
      setField('slug', slugify(name));
    }
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setField('slug', slugify(val));
  }

  function validateStep1(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.tenantName.trim() || form.tenantName.length < 2)
      errs.tenantName = "Markaz nomi kamida 2 ta belgi bo'lishi kerak";
    if (!form.slug || !/^[a-z0-9-]{3,50}$/.test(form.slug))
      errs.slug = "Slug: faqat a-z, 0-9, - (3-50 belgi)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.adminName.trim() || form.adminName.length < 2)
      errs.adminName = "Ism kamida 2 ta belgi bo'lishi kerak";
    if (!form.adminLogin || !/^[a-zA-Z0-9_.-]{3,50}$/.test(form.adminLogin))
      errs.adminLogin = "Login: faqat harflar, raqamlar, _ . - (3-50 belgi)";
    if (!form.adminPassword || form.adminPassword.length < 6)
      errs.adminPassword = "Parol kamida 6 ta belgi bo'lishi kerak";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  async function handleSubmit() {
    setLoading(true);
    setApiError('');
    try {
      const body = {
        tenant: { name: form.tenantName, slug: form.slug },
        admin: {
          name: form.adminName,
          login: form.adminLogin,
          password: form.adminPassword,
          ...(form.adminPhone ? { phone: form.adminPhone } : {}),
        },
        ...(form.branchName ? { branch: { name: form.branchName } } : {}),
      };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
      }

      setRegisteredSlug(form.slug);
      setSuccess(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border-2 border-[#10b981]/30 p-8 shadow-[0_8px_30px_-12px_rgba(16,185,129,0.3)] text-center">
            <div className="w-16 h-16 rounded-full bg-[#10b981] flex items-center justify-center mx-auto mb-4 shadow-[0_4px_0_0_#059669]">
              <Check size={32} strokeWidth={3} className="text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1e1b4b] mb-2">
              {'Muvaffaqiyatli ro\'yxatdan o\'tdingiz!'}
            </h2>
            <p className="text-[#64748b] font-semibold mb-1">
              14 kunlik bepul sinov davri boshlandi.
            </p>
            <p className="text-[#64748b] font-semibold mb-6">
              Kirish uchun:
            </p>
            <div className="bg-[#f8f5ef] rounded-xl px-4 py-3 mb-6 font-mono text-sm font-bold text-[#6d28d9] border border-[#6d28d9]/20">
              alochi.com/{registeredSlug}/login
            </div>
            <a
              href={`/${registeredSlug}/login`}
              className="inline-flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-base px-6 py-3 rounded-2xl shadow-[0_4px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all w-full"
            >
              {'Kirishga o\'tish'}
              <ArrowRight size={18} strokeWidth={2.75} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffaf0] flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
            <span className="text-white font-extrabold text-sm">A</span>
          </div>
          <span className="text-[#1e1b4b] text-xl font-black tracking-tight">A'lochi</span>
        </Link>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1e1b4b] leading-tight">
          {'Markazingizni ro\'yxatdan o\'tkazing'}
        </h1>
        <p className="mt-2 text-[#64748b] font-semibold">
          {'14 kun bepul sinov — kredit karta talab qilinmaydi'}
        </p>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-[#ede9e1] p-8 shadow-sm">
          <ProgressBar step={step} labels={['Markaz', 'Admin', 'Tasdiqlash']} />

          {/* Step 1 — Markaz ma'lumotlari */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-[#1e1b4b]">Markaz ma&apos;lumotlari</h2>

              <InputField
                label="Markaz nomi"
                id="tenantName"
                value={form.tenantName}
                onChange={handleNameChange}
                required
                placeholder="Masalan: Smart English Center"
                error={errors.tenantName}
              />

              <div>
                <InputField
                  label="Slug / URL"
                  id="slug"
                  value={form.slug}
                  onChange={handleSlugChange}
                  required
                  placeholder="smart-english"
                  pattern="^[a-z0-9-]{3,50}$"
                  error={errors.slug}
                  hint="Faqat kichik harflar, raqamlar va chiziqcha (-)"
                />
                {form.slug && !errors.slug && (
                  <div className="mt-2 bg-[#f8f5ef] rounded-lg px-3 py-2 text-xs font-bold text-[#6d28d9] border border-[#6d28d9]/15">
                    Kirish manzili: alochi.com/<strong>{form.slug}</strong>/login
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2 — Admin akkaunt */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-[#1e1b4b]">Admin akkaunt</h2>

              <InputField
                label="To'liq ism"
                id="adminName"
                value={form.adminName}
                onChange={(v) => setField('adminName', v)}
                required
                placeholder="Masalan: Alisher Karimov"
                error={errors.adminName}
              />

              <InputField
                label="Login"
                id="adminLogin"
                value={form.adminLogin}
                onChange={(v) => setField('adminLogin', v)}
                required
                placeholder="Masalan: alisher.karimov"
                hint="Faqat harflar, raqamlar, _ . -"
                error={errors.adminLogin}
              />

              <InputField
                label="Parol"
                id="adminPassword"
                type="password"
                value={form.adminPassword}
                onChange={(v) => setField('adminPassword', v)}
                required
                minLength={6}
                placeholder="Kamida 6 ta belgi"
                error={errors.adminPassword}
              />

              <InputField
                label="Telefon"
                id="adminPhone"
                type="tel"
                value={form.adminPhone}
                onChange={(v) => setField('adminPhone', v)}
                placeholder="+998 90 123 45 67"
                hint="Ixtiyoriy"
              />
            </div>
          )}

          {/* Step 3 — Tasdiqlash */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-extrabold text-[#1e1b4b]">Ma&apos;lumotlarni tasdiqlash</h2>

              <div className="space-y-3">
                <div className="bg-[#f8f5ef] rounded-xl p-4 border border-[#ede9e1]">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#94a3b8] mb-2">Markaz</p>
                  <p className="font-extrabold text-[#1e1b4b]">{form.tenantName}</p>
                  <p className="text-sm font-bold text-[#6d28d9] mt-0.5">
                    alochi.com/{form.slug}/login
                  </p>
                </div>

                <div className="bg-[#f8f5ef] rounded-xl p-4 border border-[#ede9e1]">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#94a3b8] mb-2">Admin</p>
                  <p className="font-extrabold text-[#1e1b4b]">{form.adminName}</p>
                  <p className="text-sm font-bold text-[#475569]">Login: {form.adminLogin}</p>
                  {form.adminPhone && (
                    <p className="text-sm font-bold text-[#475569]">Tel: {form.adminPhone}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-[#ecfdf5] rounded-xl p-4 border border-[#10b981]/25">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center shrink-0">
                    <Check size={16} strokeWidth={3} className="text-white" />
                  </div>
                  <div>
                    <p className="font-extrabold text-[#065f46] text-sm">14 kun bepul sinov</p>
                    <p className="text-[#047857] text-xs font-semibold">
                      Kredit karta va to&apos;lov ma&apos;lumotlari shart emas
                    </p>
                  </div>
                </div>
              </div>

              {apiError && (
                <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-xl px-4 py-3">
                  <p className="text-[#dc2626] text-sm font-bold">{apiError}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-[#1e1b4b]/12 hover:border-[#6d28d9]/30 font-extrabold text-[#1e1b4b] transition-all disabled:opacity-50"
              >
                <ArrowLeft size={16} strokeWidth={2.75} />
                Orqaga
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex-1 flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-extrabold text-base px-6 py-3 rounded-xl shadow-[0_4px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all"
              >
                Keyingi
                <ArrowRight size={18} strokeWidth={2.75} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:bg-[#6d28d9]/60 text-white font-extrabold text-base px-6 py-3 rounded-xl shadow-[0_4px_0_0_#4c1d95] active:translate-y-[2px] active:shadow-[0_2px_0_0_#4c1d95] transition-all"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Yuborilmoqda...
                  </>
                ) : (
                  <>
                    {'Ro\'yxatdan o\'tish'}
                    <Check size={18} strokeWidth={2.75} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-[#64748b]">
          {'Allaqachon hisobingiz bormi?'}{' '}
          <Link href="/login" className="text-[#6d28d9] font-extrabold hover:underline">
            {'Kirish'}
          </Link>
        </p>
      </div>
    </div>
  );
}
