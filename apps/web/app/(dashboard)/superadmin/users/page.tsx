'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Branch { id: string; name: string; }
interface User {
  id: string;
  name: string;
  login: string;
  role: string;
  status: string;
  phone?: string;
  branchId?: string;
}

const ROLES = ['student', 'mentor', 'manager', 'filadmin', 'superadmin'];
const ROLE_LABELS: Record<string, string> = {
  student: 'O\'quvchi', mentor: 'Mentor', manager: 'Menejer',
  filadmin: 'Filadmin', superadmin: 'Superadmin',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  blocked_warning: 'bg-yellow-100 text-yellow-700',
  blocked_payment: 'bg-red-100 text-red-700',
};

function emptyForm() {
  return { name: '', login: '', password: '', role: 'student', branchId: '', phone: '' };
}

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';
  const user = () => JSON.parse(localStorage.getItem('user') ?? '{}') as { tenantId?: string };

  async function loadBranches() {
    const res = await apiRequest<Branch[]>('/branches', {}, token());
    setBranches(res.data);
  }

  async function loadUsers(role = filterRole, branchId = filterBranch) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      if (branchId) params.set('branchId', branchId);
      const res = await apiRequest<User[]>(`/users?${params}`, {}, token());
      setUsers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranches().catch(() => {});
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(role: string, branchId: string) {
    setFilterRole(role);
    setFilterBranch(branchId);
    loadUsers(role, branchId);
  }

  async function toggleStatus(u: User) {
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      await apiRequest(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      }, token());
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function createUser() {
    if (!form.name.trim() || !form.login.trim() || !form.password) return;
    setSaving(true);
    setError('');
    try {
      const { tenantId } = user();
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          tenantId,
          branchId: form.branchId || undefined,
          phone: form.phone || undefined,
        }),
      }, token());
      setShowCreate(false);
      setForm(emptyForm());
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Foydalanuvchilar</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Yangi foydalanuvchi
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-700">Yangi foydalanuvchi</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'name', label: 'Ism', type: 'text' },
              { key: 'login', label: 'Login', type: 'text' },
              { key: 'password', label: 'Parol', type: 'password' },
              { key: 'phone', label: 'Telefon (ixtiyoriy)', type: 'text' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Filial (ixtiyoriy)</label>
              <select
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">— tanlanmagan —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={createUser}
              disabled={saving}
              className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-gray-500 px-3 py-1.5 border rounded-lg">
              Bekor
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <select
          value={filterRole}
          onChange={(e) => applyFilter(e.target.value, filterBranch)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Barcha rollar</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select
          value={filterBranch}
          onChange={(e) => applyFilter(filterRole, e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Barcha filiallar</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {error && !showCreate && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-sm">Foydalanuvchilar topilmadi</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{u.name}</p>
                <p className="text-xs text-gray-400">{u.login} · {ROLE_LABELS[u.role] ?? u.role}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[u.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {u.status === 'active' ? 'Faol' : u.status === 'inactive' ? 'Nofaol' : u.status}
              </span>
              {(u.status === 'active' || u.status === 'inactive') && (
                <button
                  onClick={() => toggleStatus(u)}
                  className="text-xs text-gray-400 hover:text-indigo-600 shrink-0"
                >
                  {u.status === 'active' ? 'O\'chirish' : 'Faollashtirish'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
