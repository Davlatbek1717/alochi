/* eslint-disable react/no-unescaped-entities */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  User,
  ClipboardList,
  Sparkles,
} from 'lucide-react';

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

function ProgressBar({
  step,
  labels,
}: {
  step: Step;
  labels: [string, string, string];
}) {
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
          <div
            key={s.num}
            className="flex items-center flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center">
              <div
                className={[
                  'grid place-items-center w-11 h-11 rounded-full',
                  'font-extrabold text-sm',
                  'transition-all duration-300 ease-out',
                  done
                    ? 'bg-[var(--success)] text-white shadow-[0_4px_0_0_#14532d]'
                    : active
                      ? 'bg-[var(--brand)] text-white shadow-[0_4px_0_0_var(--brand-deep)] scale-110'
                      : 'bg-[var(--surface-3)] text-[var(--ink-4)]',
                ].join(' ')}
              >
                {done ? (
                  <Check size={18} strokeWidth={3} />
                ) : (
                  <Icon size={16} strokeWidth={2.5} />
                )}
              </div>
              <span
                className={[
                  'mt-2 text-[10px] font-extrabold uppercase tracking-[0.18em]',
                  active
                    ? 'text-[var(--brand)]'
                    : done
                      ? 'text-[var(--success)]'
                      : 'text-[var(--ink-4)]',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-[2.5px] mx-3 mb-6 rounded-full',
                  'transition-all duration-500',
                  step > s.num ? 'bg-[var(--success)]' : 'bg-[var(--surface-3)]',
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
      <label
        htmlFor={id}
        className="block text-[11px] font-extrabold text-[var(--ink-3)] uppercase tracking-[0.16em] mb-2"
      >
        {label}{' '}
        {required && (
          <span className="text-[var(--danger)] normal-case tracking-normal">
            *
          </span>
        )}
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
          'w-full px-4 py-3.5 rounded-xl',
          'border-[1.5px] font-medium text-[var(--ink)]',
          'bg-[var(--surface-2)] placeholder:text-[var(--ink-4)] placeholder:font-normal',
          'outline-none transition-all duration-150',
          'focus:bg-[var(--surface)] focus:ring-4',
          error
            ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/12'
            : 'border-[var(--line-strong)] focus:border-[var(--brand)] focus:ring-[var(--brand)]/12',
        ].join(' ')}
      />
      {hint && !error && (
        <p className="mt-2 text-xs text-[var(--ink-3)]">{hint}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-[var(--danger)] font-semibold">
          {error}
        </p>
      )}
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
      errs.slug = 'Slug: faqat a-z, 0-9, - (3-50 belgi)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Partial<FormData> = {};
    if (!form.adminName.trim() || form.adminName.length < 2)
      errs.adminName = "Ism kamida 2 ta belgi bo'lishi kerak";
    if (!form.adminLogin || !/^[a-zA-Z0-9_.-]{3,50}$/.test(form.adminLogin))
      errs.adminLogin = 'Login: faqat harflar, raqamlar, _ . - (3-50 belgi)';
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
        throw new Error(
          data?.message ?? "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
        );
      }

      setRegisteredSlug(form.slug);
      setSuccess(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen relative bg-[var(--background)] flex items-center justify-center px-4 py-16 overflow-hidden">
        {/* Atmosphere */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-[var(--success)]/15 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[380px] h-[380px] rounded-full bg-[var(--brand)]/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div
            className={[
              'bg-[var(--surface)] rounded-3xl p-10',
              'border-2 border-[var(--success)]/30',
              'shadow-[0_24px_60px_-24px_rgba(21,128,61,0.35)]',
              'text-center',
            ].join(' ')}
          >
            <div
              className={[
                'grid place-items-center w-20 h-20 rounded-full mx-auto mb-6',
                'bg-[var(--success)] text-white',
                'shadow-[0_6px_0_0_#14532d]',
                'motion-safe:[animation:bounce-in_550ms_var(--ease-spring)]',
              ].join(' ')}
            >
              <Check size={36} strokeWidth={3.25} />
            </div>
            <h2 className="font-display text-3xl font-bold text-[var(--ink)] mb-2 tracking-[-0.01em]">
              Muvaffaqiyatli ro&apos;yxatdan o&apos;tdingiz!
            </h2>
            <p className="text-[var(--ink-2)] mb-1">
              14 kunlik bepul sinov davri boshlandi.
            </p>
            <p className="text-[var(--ink-3)] mb-6 text-sm">
              Markaz kirish manzili:
            </p>
            <div
              className={[
                'bg-[var(--surface-2)] rounded-xl px-4 py-3 mb-7',
                'font-mono text-sm font-bold text-[var(--brand)]',
                'border border-[var(--brand)]/20',
              ].join(' ')}
            >
              alochi.com/{registeredSlug}/login
            </div>
            <a
              href={`/${registeredSlug}/login`}
              className={[
                'group inline-flex items-center justify-center gap-2.5',
                'bg-[var(--brand)] text-white font-extrabold text-base tracking-wide',
                'px-6 py-4 rounded-2xl w-full',
                'border-b-[5px] border-[var(--brand-deep)]',
                'hover:bg-[var(--brand-strong)]',
                'active:translate-y-[3px] active:border-b-[2px]',
                'transition-all duration-150',
              ].join(' ')}
            >
              Kirishga o&apos;tish
              <ArrowRight
                size={18}
                strokeWidth={2.75}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[var(--background)] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Atmosphere */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/4 w-[420px] h-[420px] rounded-full bg-[var(--brand)]/12 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[420px] h-[300px] rounded-full bg-[var(--accent)]/10 blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative mb-10 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-7 group">
          <div
            className={[
              'grid place-items-center w-10 h-10 rounded-xl',
              'bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)]',
              'shadow-[0_4px_12px_-4px_rgba(109,40,217,0.5)]',
              'transition-transform duration-300 group-hover:rotate-[-8deg]',
            ].join(' ')}
          >
            <span className="text-white font-extrabold text-sm">A</span>
          </div>
          <span className="font-display text-[var(--ink)] text-2xl font-bold tracking-tight">
            A&apos;lochi
          </span>
        </Link>
        <span
          className={[
            'inline-flex items-center gap-2',
            'px-3.5 py-1.5 rounded-full',
            'bg-[var(--brand-soft)] border border-[var(--brand)]/15',
            'text-[var(--brand)] text-[11px] font-extrabold uppercase tracking-[0.2em]',
            'mb-5',
          ].join(' ')}
        >
          <Sparkles size={13} strokeWidth={2.75} />
          14 kun bepul
        </span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--ink)] leading-[1.05] tracking-[-0.02em]">
          Markazingizni
          <br />
          <span className="italic font-medium text-[var(--brand)]">
            ro&apos;yxatdan o&apos;tkazing
          </span>
        </h1>
        <p className="mt-4 text-[var(--ink-2)] max-w-md mx-auto">
          Kredit karta talab qilinmaydi — sinov muddati avtomatik tugaydi
        </p>
      </div>

      <div className="relative w-full max-w-md">
        <div
          className={[
            'bg-[var(--surface)] rounded-3xl p-8',
            'border border-[var(--line)]',
            'shadow-[var(--shadow-3)]',
          ].join(' ')}
        >
          <ProgressBar
            step={step}
            labels={['Markaz', 'Admin', 'Tasdiqlash']}
          />

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                Markaz ma&apos;lumotlari
              </h2>

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
                  <div
                    className={[
                      'mt-2.5 bg-[var(--brand-soft)] rounded-lg px-3.5 py-2.5',
                      'text-xs font-bold text-[var(--brand)]',
                      'border border-[var(--brand)]/20',
                    ].join(' ')}
                  >
                    Kirish manzili: alochi.com/<strong>{form.slug}</strong>
                    /login
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                Admin akkaunt
              </h2>

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

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-[var(--ink)] tracking-[-0.01em]">
                Ma&apos;lumotlarni tasdiqlash
              </h2>

              <div className="space-y-3">
                <SummaryCard label="Markaz">
                  <p className="font-display font-bold text-[var(--ink)] text-lg">
                    {form.tenantName}
                  </p>
                  <p className="font-mono text-sm font-bold text-[var(--brand)] mt-1">
                    alochi.com/{form.slug}/login
                  </p>
                </SummaryCard>

                <SummaryCard label="Admin">
                  <p className="font-display font-bold text-[var(--ink)] text-lg">
                    {form.adminName}
                  </p>
                  <p className="text-sm text-[var(--ink-2)] mt-0.5">
                    Login:{' '}
                    <span className="font-mono font-semibold">
                      {form.adminLogin}
                    </span>
                  </p>
                  {form.adminPhone && (
                    <p className="text-sm text-[var(--ink-2)]">
                      Tel: {form.adminPhone}
                    </p>
                  )}
                </SummaryCard>

                <div
                  className={[
                    'flex items-center gap-3.5',
                    'bg-[var(--success-soft)] rounded-xl p-4',
                    'border border-[var(--success)]/25',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'grid place-items-center w-9 h-9 rounded-xl',
                      'bg-[var(--success)] text-white',
                      'shadow-[0_3px_0_0_#14532d]',
                      'shrink-0',
                    ].join(' ')}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="font-extrabold text-[var(--success)] text-sm">
                      14 kun bepul sinov
                    </p>
                    <p className="text-[var(--success)]/80 text-xs">
                      Kredit karta va to&apos;lov ma&apos;lumotlari shart emas
                    </p>
                  </div>
                </div>
              </div>

              {apiError && (
                <div
                  className={[
                    'bg-[var(--danger-soft)] rounded-xl px-4 py-3',
                    'border border-[var(--danger)]/30',
                  ].join(' ')}
                >
                  <p className="text-[var(--danger)] text-sm font-bold">
                    {apiError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-9 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                disabled={loading}
                className={[
                  'flex items-center gap-2',
                  'px-5 py-3.5 rounded-xl',
                  'border-[1.5px] border-[var(--line-strong)]',
                  'hover:border-[var(--ink)] hover:bg-[var(--surface-2)]',
                  'font-bold text-[var(--ink)] text-sm',
                  'transition-all duration-150',
                  'disabled:opacity-50',
                ].join(' ')}
              >
                <ArrowLeft size={16} strokeWidth={2.75} />
                Orqaga
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className={[
                  'group flex-1 flex items-center justify-center gap-2',
                  'bg-[var(--brand)] text-white font-extrabold text-sm tracking-wide',
                  'px-6 py-3.5 rounded-xl',
                  'border-b-[4px] border-[var(--brand-deep)]',
                  'hover:bg-[var(--brand-strong)]',
                  'active:translate-y-[2px] active:border-b-[1px]',
                  'transition-all duration-150',
                ].join(' ')}
              >
                Keyingi
                <ArrowRight
                  size={18}
                  strokeWidth={2.75}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className={[
                  'group flex-1 flex items-center justify-center gap-2',
                  'bg-[var(--brand)] text-white font-extrabold text-sm tracking-wide',
                  'px-6 py-3.5 rounded-xl',
                  'border-b-[4px] border-[var(--brand-deep)]',
                  'hover:bg-[var(--brand-strong)]',
                  'active:translate-y-[2px] active:border-b-[1px]',
                  'transition-all duration-150',
                  'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0',
                ].join(' ')}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Yuborilmoqda…
                  </>
                ) : (
                  <>
                    Ro&apos;yxatdan o&apos;tish
                    <Check size={18} strokeWidth={2.75} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--ink-3)]">
          Allaqachon hisobingiz bormi?{' '}
          <Link
            href="/login"
            className="text-[var(--brand)] hover:text-[var(--brand-strong)] font-semibold underline decoration-[1.5px] underline-offset-4 decoration-[var(--brand)]/40 hover:decoration-[var(--brand)] transition-all"
          >
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'bg-[var(--surface-2)] rounded-xl p-4',
        'border border-[var(--line)]',
      ].join(' ')}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--ink-4)] mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
