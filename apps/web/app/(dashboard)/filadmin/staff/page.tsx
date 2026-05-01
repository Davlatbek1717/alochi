'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  UserCog,
  Plus,
  ChevronDown,
  Pencil,
  Power,
  KeyRound,
  Filter,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  EmptyState,
  Skeleton,
  Modal,
  useToast,
} from '@/components/ui';

type StaffRole = 'mentor' | 'manager' | 'tester';
type AnyRole = StaffRole | 'student' | 'filadmin' | 'superadmin';

interface User {
  id: string;
  name: string;
  login: string;
  role: AnyRole;
  status: string;
  phone?: string | null;
  branchId?: string | null;
}

const ROLE_OPTIONS: StaffRole[] = ['mentor', 'manager', 'tester'];
const ROLE_LABEL: Record<StaffRole, string> = {
  mentor: 'Mentor',
  manager: 'Menejer',
  tester: 'Tester',
};
const ROLE_BADGE: Record<StaffRole, string> = {
  mentor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  manager: 'bg-violet-50 text-violet-700 border-violet-100',
  tester: 'bg-amber-50 text-amber-700 border-amber-100',
};

function emptyForm() {
  return {
    name: '',
    login: '',
    password: '',
    role: 'mentor' as StaffRole,
    phone: '',
  };
}

function getMe(): { tenantId: string; branchId: string } {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      tenantId?: string;
      branchId?: string;
    };
    return { tenantId: u.tenantId ?? '', branchId: u.branchId ?? '' };
  } catch {
    return { tenantId: '', branchId: '' };
  }
}

export default function FiladminStaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StaffRole | ''>('');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('mentor');
  const [editSaving, setEditSaving] = useState(false);

  // Reset password modal
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<User | null>(null);
  const [toggleSaving, setToggleSaving] = useState(false);

  const me = useMemo(() => getMe(), []);
  const token = () => localStorage.getItem('accessToken') ?? '';

  async function load() {
    if (!me.branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<User[]>(
        `/users/by-branch/${me.branchId}`,
        {},
        token(),
      );
      setStaff(res.data.filter((u) => u.role !== 'student'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter ? staff.filter((s) => s.role === filter) : staff;

  async function createStaff() {
    if (!form.name.trim() || !form.login.trim() || form.password.length < 6) {
      toast.error('Ism, login va kamida 6 ta belgili parol kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            login: form.login.trim(),
            password: form.password,
            role: form.role,
            phone: form.phone || undefined,
            branchId: me.branchId,
            tenantId: me.tenantId,
          }),
        },
        token(),
      );
      toast.success('Xodim qo‘shildi');
      setCreateOpen(false);
      setForm(emptyForm());
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: User) {
    setEditing(u);
    setEditName(u.name);
    setEditPhone(u.phone ?? '');
    setEditRole(u.role as StaffRole);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Ism kerak');
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(
        `/users/${editing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: editName.trim(),
            phone: editPhone || null,
            role: editRole,
          }),
        },
        token(),
      );
      toast.success('Saqlandi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setEditSaving(false);
    }
  }

  async function doToggle() {
    if (!toggleTarget) return;
    const next = toggleTarget.status === 'active' ? 'inactive' : 'active';
    setToggleSaving(true);
    try {
      await apiRequest(
        `/users/${toggleTarget.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        },
        token(),
      );
      toast.success(next === 'active' ? 'Faollashtirildi' : 'O‘chirildi');
      setToggleTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setToggleSaving(false);
    }
  }

  async function doReset() {
    if (!resetting) return;
    if (newPassword.length < 6) {
      toast.error('Parol kamida 6 ta belgi');
      return;
    }
    setResetSaving(true);
    try {
      await apiRequest(
        `/users/${resetting.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
        },
        token(),
      );
      toast.success('Parol yangilandi');
      setResetting(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, #6366f1 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <UserCog size={18} className="text-indigo-300" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                Filadmin
              </p>
              <p className="text-white font-bold text-lg">Xodimlar</p>
            </div>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
          >
            <Plus size={16} />
            Yangi
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Filter */}
        <div className="flex gap-2 items-center flex-wrap">
          <Filter size={14} className="text-[#94a3b8]" />
          <button
            onClick={() => setFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              filter === ''
                ? 'bg-[#0f172a] text-white'
                : 'bg-white text-[#64748b] border border-[#ede9e1]'
            }`}
          >
            Hammasi
          </button>
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filter === r
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-[#64748b] border border-[#ede9e1]'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className="h-16 rounded-[18px]"
                theme="light"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<UserCog size={28} />}
              title="Xodim yo‘q"
              description="Birinchi xodimni qo‘shing"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {filtered.length} ta xodim
            </p>
            {filtered.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-[#94a3b8]">{u.login}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                    ROLE_BADGE[u.role as StaffRole] ??
                    'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                  }`}
                >
                  {ROLE_LABEL[u.role as StaffRole] ?? u.role}
                </span>
                <button
                  onClick={() => startEdit(u)}
                  aria-label="Tahrirlash"
                  className="w-8 h-8 bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setResetting(u)}
                  aria-label="Parolni tiklash"
                  className="w-8 h-8 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors"
                >
                  <KeyRound size={14} />
                </button>
                <button
                  onClick={() => setToggleTarget(u)}
                  aria-label={u.status === 'active' ? 'O‘chirish' : 'Faollashtirish'}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    u.status === 'active'
                      ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Power size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Yangi xodim"
        theme="light"
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="staff-name"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Ism *
            </label>
            <input
              id="staff-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="staff-login"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Login *
              </label>
              <input
                id="staff-login"
                value={form.login}
                onChange={(e) =>
                  setForm({ ...form, login: e.target.value })
                }
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              />
            </div>
            <div>
              <label
                htmlFor="staff-password"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Parol *
              </label>
              <input
                id="staff-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="staff-role"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Rol *
              </label>
              <div className="relative">
                <select
                  id="staff-role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as StaffRole,
                    })
                  }
                  className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="staff-phone"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Telefon
              </label>
              <input
                id="staff-phone"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setCreateOpen(false)}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={createStaff}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-xl bg-[#0f172a] text-white font-semibold disabled:opacity-50"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Xodimni tahrirlash"
        theme="light"
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-name"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Ism
            </label>
            <input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-phone"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Telefon
              </label>
              <input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              />
            </div>
            <div>
              <label
                htmlFor="edit-role"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Rol
              </label>
              <div className="relative">
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(e.target.value as StaffRole)
                  }
                  className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={saveEdit}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl bg-[#0f172a] text-white font-semibold disabled:opacity-50"
            >
              {editSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={resetting !== null}
        onClose={() => !resetSaving && setResetting(null)}
        title="Parolni tiklash"
        theme="light"
      >
        <div className="space-y-3">
          <p className="text-sm text-[#64748b]">
            <span className="font-semibold text-[#0f172a]">
              {resetting?.name}
            </span>{' '}
            uchun yangi parolni kiriting va xodimga aytib qo‘ying.
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Yangi parol (6+ belgi)"
            autoFocus
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          />
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setResetting(null)}
              disabled={resetSaving}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={doReset}
              disabled={resetSaving || newPassword.length < 6}
              className="text-sm px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
            >
              {resetSaving ? 'Saqlanmoqda...' : 'Tiklash'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toggle confirm */}
      <Modal
        open={toggleTarget !== null}
        onClose={() => !toggleSaving && setToggleTarget(null)}
        title={
          toggleTarget?.status === 'active'
            ? 'Xodimni o‘chirish'
            : 'Xodimni faollashtirish'
        }
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">
            {toggleTarget?.name}
          </span>{' '}
          {toggleTarget?.status === 'active'
            ? 'o‘chirilsinmi? Xodim tizimga kira olmaydi.'
            : 'qayta faollashtirilsinmi?'}
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setToggleTarget(null)}
            disabled={toggleSaving}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Yo‘q
          </button>
          <button
            onClick={doToggle}
            disabled={toggleSaving}
            className={`text-sm px-4 py-2 rounded-xl text-white font-semibold disabled:opacity-50 ${
              toggleTarget?.status === 'active'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {toggleSaving
              ? 'Saqlanmoqda...'
              : toggleTarget?.status === 'active'
                ? 'Ha, o‘chir'
                : 'Faollashtirish'}
          </button>
        </div>
      </Modal>

    </div>
  );
}
