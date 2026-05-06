'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useTranslations } from 'next-intl';

interface LoginResponse {
  // Normal login response
  accessToken?: string;
  refreshToken?: string;
  user?: { role: string; id: string; name: string; tenantId: string };
  // 2FA challenge response
  status?: '2fa_required';
  tempToken?: string;
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
 * LoginForm — login + parol only.
 *
 * The Markaz (tenant slug) field used to live here as an "ixtiyoriy"
 * input. The backend now resolves the user from the login alone (see
 * auth.service.ts: prefer superadmin → fall back to a globally-unique
 * login → ambiguity error if multiple matches), so the form no longer
 * needs to ask for the slug. This is also a UX win — most operators
 * don't know their slug and were leaving the field blank, which was
 * the very thing that broke non-superadmin login before.
 */
export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations('auth');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      // Check for 2FA challenge
      if (res.data.status === '2fa_required' && res.data.tempToken) {
        setTempToken(res.data.tempToken);
        setTwoFaRequired(true);
        setLoading(false);
        return;
      }
      localStorage.setItem('accessToken', res.data.accessToken!);
      localStorage.setItem('refreshToken', res.data.refreshToken!);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push(ROLE_ROUTES[res.data.user!.role] ?? '/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    setTwoFaLoading(true);
    try {
      const res = await apiRequest<LoginResponse>('/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code: twoFaCode }),
      });
      localStorage.setItem('accessToken', res.data.accessToken!);
      localStorage.setItem('refreshToken', res.data.refreshToken!);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.replace(ROLE_ROUTES[res.data.user!.role] ?? '/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kod noto'g'ri");
    } finally {
      setTwoFaLoading(false);
    }
  }

  if (twoFaRequired) {
    return (
      <form onSubmit={handleVerify2fa} className="flex flex-col gap-4">
        <div className="text-center mb-2">
          <p className="text-sm font-extrabold text-[#1e1b4b]">
            Ikki bosqichli tasdiqlash
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Telefon ilovasidagi 6 ta raqamni yoki backup kodni kiriting
          </p>
        </div>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000 yoki XXXX-XXXX"
          value={twoFaCode}
          onChange={(e) => setTwoFaCode(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-[#e8e0d0] bg-white text-[#1e1b4b] font-bold text-center text-xl tracking-widest focus:border-[#6d28d9] focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={twoFaLoading || twoFaCode.length < 6}
          className="w-full py-3 rounded-xl bg-[#6d28d9] text-white font-extrabold disabled:opacity-50 hover:bg-[#5b21b6] transition-colors"
        >
          {twoFaLoading ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
        </button>
        <button
          type="button"
          onClick={() => { setTwoFaRequired(false); setTwoFaCode(''); setTempToken(''); }}
          className="text-xs text-[#64748b] text-center hover:underline"
        >
          Orqaga qaytish
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
          {t('username')}
        </label>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="loginni kiriting"
          required
          autoFocus
          autoComplete="username"
          className="w-full border-[1.5px] border-[#ede9e1] rounded-xl px-4 py-3 text-sm text-[#0f172a] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-[#94a3b8]"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
          {t('password')}
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border-[1.5px] border-[#ede9e1] rounded-xl px-4 py-3 pr-11 text-sm text-[#0f172a] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-[#94a3b8]"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? 'Parolni yashirish' : "Parolni ko'rsatish"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 rounded transition-colors"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1e293b] active:bg-[#0a0f1e] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:ring-offset-2 transition-all mt-2"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogIn size={16} />
        )}
        {loading ? t('submit') + '...' : t('submit')}
      </button>
    </form>
  );
}
