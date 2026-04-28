'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { role: string; id: string; name: string; tenantId: string };
}

const ROLE_ROUTES: Record<string, string> = {
  superadmin: '/superadmin',
  filadmin:   '/filadmin',
  manager:    '/manager',
  mentor:     '/mentor',
  tester:     '/tester',
  student:    '/student',
};

export function LoginForm() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
      setError(err instanceof Error ? err.message : 'Login yoki parol noto\'g\'ri');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
          Login
        </label>
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="loginni kiriting"
          required
          className="w-full border-[1.5px] border-[#ede9e1] rounded-xl px-4 py-3 text-sm text-[#0f172a] outline-none focus:border-indigo-400 transition-colors placeholder:text-[#94a3b8]"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1.5">
          Parol
        </label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border-[1.5px] border-[#ede9e1] rounded-xl px-4 py-3 pr-11 text-sm text-[#0f172a] outline-none focus:border-indigo-400 transition-colors placeholder:text-[#94a3b8]"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
          <p className="text-rose-600 text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1e293b] disabled:opacity-50 transition-colors mt-2"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <LogIn size={16} />
        )}
        {loading ? 'Kirish...' : 'Kirish'}
      </button>
    </form>
  );
}
