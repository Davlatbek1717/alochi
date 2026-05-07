'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, User, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { role: string; id: string; name: string; tenantId: string };
}

const ROLE_ROUTES: Record<string, string> = {
  superadmin: '/superadmin',
  filadmin: '/filadmin',
  manager: '/manager',
  mentor: '/mentor',
  tester: '/tester',
  student: '/student',
};

/**
 * LoginForm — login + parol.
 *
 * Backend resolves the tenant from the login alone (auth.service.ts):
 * prefer superadmin → fall back to a globally-unique login → ambiguity
 * error if multiple matches. The user does not need to know their
 * markaz slug.
 */
export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push(ROLE_ROUTES[res.data.user.role] ?? '/');
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Login yoki parol noto'g'ri",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Login" htmlFor="login-input">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-4)]">
          <User size={16} strokeWidth={2.5} />
        </span>
        <input
          id="login-input"
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="loginingizni kiriting"
          required
          autoFocus
          autoComplete="username"
          className={[
            'w-full pl-10 pr-4 py-3.5',
            'border-[1.5px] border-[var(--line-strong)] rounded-xl',
            'bg-[var(--surface-2)]',
            'text-sm text-[var(--ink)] font-medium',
            'placeholder:text-[var(--ink-4)] placeholder:font-normal',
            'outline-none',
            'focus:border-[var(--brand)] focus:bg-[var(--surface)]',
            'focus:ring-4 focus:ring-[var(--brand)]/12',
            'transition-all duration-150',
          ].join(' ')}
        />
      </Field>

      <Field label="Parol" htmlFor="password-input">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-4)]">
          <Lock size={16} strokeWidth={2.5} />
        </span>
        <input
          id="password-input"
          type={showPwd ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className={[
            'w-full pl-10 pr-12 py-3.5',
            'border-[1.5px] border-[var(--line-strong)] rounded-xl',
            'bg-[var(--surface-2)]',
            'text-sm text-[var(--ink)] font-medium',
            'placeholder:text-[var(--ink-4)] placeholder:font-normal',
            'outline-none',
            'focus:border-[var(--brand)] focus:bg-[var(--surface)]',
            'focus:ring-4 focus:ring-[var(--brand)]/12',
            'transition-all duration-150',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => setShowPwd((v) => !v)}
          aria-label={showPwd ? 'Parolni yashirish' : "Parolni ko'rsatish"}
          className={[
            'absolute right-3 top-1/2 -translate-y-1/2',
            'grid place-items-center w-8 h-8 rounded-lg',
            'text-[var(--ink-4)] hover:text-[var(--ink)] hover:bg-[var(--surface-3)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
            'transition-colors',
          ].join(' ')}
        >
          {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </Field>

      <button
        type="submit"
        disabled={loading}
        className={[
          'group w-full mt-1 flex items-center justify-center gap-2',
          'bg-[var(--brand)] text-white font-extrabold text-sm tracking-wide',
          'py-4 rounded-xl',
          'border-b-[4px] border-[var(--brand-deep)]',
          'hover:bg-[var(--brand-strong)]',
          'active:translate-y-[2px] active:border-b-[1px]',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
          'transition-all duration-150 ease-out',
        ].join(' ')}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Kirilmoqda…</span>
          </>
        ) : (
          <>
            Kirish
            <ArrowRight
              size={16}
              strokeWidth={2.75}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-extrabold text-[var(--ink-3)] uppercase tracking-[0.16em] mb-2"
      >
        {label}
      </label>
      <div className="relative">{children}</div>
    </div>
  );
}
