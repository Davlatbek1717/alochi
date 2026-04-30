'use client';
import { useEffect, useState } from 'react';
import { Users, Plus, X, ChevronDown, UserCheck, UserX, Filter } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';

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
  student: "O'quvchi", mentor: 'Mentor', manager: 'Menejer',
  filadmin: 'Filadmin', superadmin: 'Superadmin',
};
const ROLE_COLORS: Record<string, string> = {
  student: 'bg-blue-50 text-blue-700 border-blue-100',
  mentor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  manager: 'bg-violet-50 text-violet-700 border-violet-100',
  filadmin: 'bg-amber-50 text-amber-700 border-amber-100',
  superadmin: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

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
  const toast = useToast();

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
      toast.error(err instanceof Error ? err.message : 'Xatolik');
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
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function createUser() {
    if (!form.name.trim() || !form.login.trim() || !form.password) return;
    setSaving(true);
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
      toast.success('Foydalanuvchi yaratildi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Users size={18} className="text-violet-400" />
              </div>
              <p className="text-white font-bold text-lg">Foydalanuvchilar</p>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
            >
              {showCreate ? <X size={16} /> : <Plus size={16} />}
              {showCreate ? 'Yopish' : 'Yangi'}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Create form */}
        {showCreate && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Yangi foydalanuvchi</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Ism', type: 'text' },
                { key: 'login', label: 'Login', type: 'text' },
                { key: 'password', label: 'Parol', type: 'password' },
                { key: 'phone', label: 'Telefon (ixtiyoriy)', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label htmlFor={`user-${key}`} className="block text-xs text-[#94a3b8] mb-1">{label}</label>
                  <input
                    id={`user-${key}`}
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
                  />
                </div>
              ))}
              <div>
                <label htmlFor="user-role" className="block text-xs text-[#94a3b8] mb-1">Rol</label>
                <div className="relative">
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="user-branch" className="block text-xs text-[#94a3b8] mb-1">Filial (ixtiyoriy)</label>
                <div className="relative">
                  <select
                    id="user-branch"
                    value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                    className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                  >
                    <option value="">— tanlanmagan —</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createUser}
                disabled={saving}
                className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button onClick={() => setShowCreate(false)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">
                Bekor
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <Filter size={14} className="text-[#94a3b8]" />
          <div className="relative">
            <select
              value={filterRole}
              onChange={(e) => applyFilter(e.target.value, filterBranch)}
              aria-label="Rol bo'yicha filtrlash"
              className="appearance-none bg-white border border-[#ede9e1] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-7"
            >
              <option value="">Barcha rollar</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterBranch}
              onChange={(e) => applyFilter(filterRole, e.target.value)}
              aria-label="Filial bo'yicha filtrlash"
              className="appearance-none bg-white border border-[#ede9e1] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-7"
            >
              <option value="">Barcha filiallar</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-[18px]" theme="light" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Users size={28} />}
              title="Foydalanuvchilar topilmadi"
              description="Filtr shartlariga mos foydalanuvchi yo'q"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{users.length} ta foydalanuvchi</p>
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">{u.name}</p>
                  <p className="text-xs text-[#94a3b8]">{u.login}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[u.role] ?? 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'}`}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                {(u.status === 'active' || u.status === 'inactive') && (
                  <button
                    onClick={() => toggleStatus(u)}
                    className={`shrink-0 p-2 rounded-xl transition-colors ${
                      u.status === 'active'
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-[#94a3b8] bg-[#f7f4ef] hover:bg-[#ede9e1]'
                    }`}
                    title={u.status === 'active' ? "O'chirish" : 'Faollashtirish'}
                  >
                    {u.status === 'active' ? <UserCheck size={16} /> : <UserX size={16} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
