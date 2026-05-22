'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  X,
  ChevronDown,
  UserCheck,
  UserX,
  Pencil,
  KeyRound,
  Trash2,
  Search,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

interface Branch {
  id: string;
  name: string;
}
interface User {
  id: string;
  name: string;
  login: string;
  role: string;
  status: string;
  phone?: string;
  branchId?: string;
  groupId?: string;
}

const ROLES = ['student', 'mentor', 'manager', 'tester', 'filadmin', 'superadmin'];
const ROLE_LABELS: Record<string, string> = {
  student: "O'quvchi",
  mentor: 'Mentor',
  manager: 'Menejer',
  tester: 'Tester',
  filadmin: 'Filadmin',
  superadmin: 'Superadmin',
};
const ROLE_COLORS: Record<string, string> = {
  student: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  mentor: 'bg-[#15803d]/10 text-[#15803d] border-[#15803d]/30',
  manager: 'bg-[#6d28d9]/10 text-[#6d28d9] border-[#6d28d9]/30',
  tester: 'bg-orange-50 text-orange-700 border-orange-200',
  filadmin: 'bg-[#0f172a]/[0.08] text-[#0f172a] border-[#ede9e1]',
  superadmin: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function emptyForm() {
  return {
    name: '',
    login: '',
    password: '',
    role: 'student',
    branchId: '',
    phone: '',
  };
}

export default function SuperadminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  // Client-side search query layered on top of the server's role+branch
  // filter — typing instantly narrows the rendered list without refetching.
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'student',
    branchId: '',
    phone: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string; branchId: string }[]>([]);
  const [editGroupId, setEditGroupId] = useState('');

  // Password reset
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // Delete confirmation
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const toast = useToast();

  // Derive the rendered list from the fetched users + client-side search.
  // useMemo keeps it cheap on long lists; trim+lowercase once per keystroke.
  const visibleUsers = useMemo<User[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.login.toLowerCase().includes(q),
    );
  }, [users, search]);

  const token = () =>
    typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';
  async function loadBranches() {
    const res = await apiRequest<Branch[]>('/branches', {}, token());
    setBranches(res.data);
  }

  async function loadGroupsForBranch(branchId: string) {
    if (!branchId) { setGroups([]); return; }
    try {
      const res = await apiRequest<{ id: string; name: string; branchId: string }[]>(
        `/groups?branchId=${branchId}`,
        {},
        token(),
      );
      setGroups(res.data ?? []);
    } catch {
      setGroups([]);
    }
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

  // When role or branch changes in edit form, reload groups
  useEffect(() => {
    if (!editing) return;
    if ((editForm.role === 'student' || editForm.role === 'mentor') && editForm.branchId) {
      loadGroupsForBranch(editForm.branchId).catch(() => {});
    } else {
      setGroups([]);
    }
  }, [editForm.role, editForm.branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(role: string, branchId: string) {
    setFilterRole(role);
    setFilterBranch(branchId);
    loadUsers(role, branchId);
  }

  async function toggleStatus(u: User) {
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      await apiRequest(
        `/users/${u.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: next }),
        },
        token(),
      );
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, status: next } : x)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function createUser() {
    if (!form.name.trim() || !form.login.trim() || !form.password) return;
    setSaving(true);
    try {
      await apiRequest(
        '/users',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            branchId: form.branchId || undefined,
            phone: form.phone || undefined,
          }),
        },
        token(),
      );
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

  function startEdit(u: User) {
    setEditing(u);
    setEditForm({
      name: u.name,
      role: u.role,
      branchId: u.branchId ?? '',
      phone: u.phone ?? '',
    });
    setEditGroupId(u.groupId ?? '');
    if (u.branchId && (u.role === 'student' || u.role === 'mentor')) {
      loadGroupsForBranch(u.branchId).catch(() => {});
    } else {
      setGroups([]);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.name.trim()) {
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
            name: editForm.name.trim(),
            role: editForm.role,
            branchId: editForm.branchId || null,
            phone: editForm.phone || null,
            groupId: (editForm.role === 'student' || editForm.role === 'mentor')
              ? (editGroupId || null)
              : null,
          }),
        },
        token(),
      );
      toast.success('Saqlandi');
      setEditing(null);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setEditSaving(false);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    setDeleteSaving(true);
    try {
      await apiRequest(
        `/users/${deleting.id}`,
        { method: 'DELETE' },
        token(),
      );
      setUsers((prev) => prev.filter((x) => x.id !== deleting.id));
      toast.success("Foydalanuvchi o'chirildi");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setDeleteSaving(false);
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
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
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

      <div className="px-4 pt-4 pb-6 space-y-4">
        {showCreate && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              Yangi foydalanuvchi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'name', label: 'Ism', type: 'text' },
                { key: 'login', label: 'Login', type: 'text' },
                { key: 'password', label: 'Parol', type: 'password' },
                { key: 'phone', label: 'Telefon (ixtiyoriy)', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label
                    htmlFor={`user-${key}`}
                    className="block text-xs text-[#94a3b8] mb-1"
                  >
                    {label}
                  </label>
                  <input
                    id={`user-${key}`}
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                    className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
                  />
                </div>
              ))}
              <div>
                <label
                  htmlFor="user-role"
                  className="block text-xs text-[#94a3b8] mb-1"
                >
                  Rol
                </label>
                <div className="relative">
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                    className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
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
                  htmlFor="user-branch"
                  className="block text-xs text-[#94a3b8] mb-1"
                >
                  Filial (ixtiyoriy)
                </label>
                <div className="relative">
                  <select
                    id="user-branch"
                    value={form.branchId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, branchId: e.target.value }))
                    }
                    className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                  >
                    <option value="">— tanlanmagan —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
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
            <div className="flex gap-2">
              <button
                onClick={createUser}
                disabled={saving}
                className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold"
              >
                Bekor
              </button>
            </div>
          </div>
        )}

        {/* Search — client-side filter on top of server-fetched list */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Ism yoki login boʻyicha qidirish"
            placeholder="Ism yoki login boʻyicha qidiring..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 placeholder:text-[#94a3b8]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Qidiruvni tozalash"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg hover:bg-[#f7f4ef] flex items-center justify-center text-[#94a3b8]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Role chip group */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">
            Rol
          </p>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={filterRole === ''}
              onClick={() => applyFilter('', filterBranch)}
              label="Barchasi"
            />
            {ROLES.map((r) => (
              <FilterChip
                key={r}
                active={filterRole === r}
                onClick={() => applyFilter(r, filterBranch)}
                label={ROLE_LABELS[r]}
              />
            ))}
          </div>
        </div>

        {/* Branch chip group — wrapped in horizontal scroll on tight screens */}
        {branches.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">
              Filial
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={filterBranch === ''}
                onClick={() => applyFilter(filterRole, '')}
                label="Barchasi"
              />
              {branches.map((b) => (
                <FilterChip
                  key={b.id}
                  active={filterBranch === b.id}
                  onClick={() => applyFilter(filterRole, b.id)}
                  label={b.name}
                />
              ))}
            </div>
          </div>
        )}

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
        ) : visibleUsers.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Users size={28} />}
              title="Foydalanuvchilar topilmadi"
              description={
                search
                  ? `"${search}" boʻyicha hech narsa topilmadi`
                  : "Filtr shartlariga mos foydalanuvchi yo'q"
              }
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {visibleUsers.length === users.length
                ? `${users.length} ta foydalanuvchi`
                : `${visibleUsers.length} / ${users.length} ta foydalanuvchi`}
            </p>
            {visibleUsers.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3 flex-wrap"
              >
                <div className="w-9 h-9 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {getInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-[#94a3b8]">{u.login}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap shrink-0 ${
                    ROLE_COLORS[u.role] ??
                    'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                  }`}
                >
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startEdit(u)}
                  aria-label="Tahrirlash"
                  className="min-w-[40px] min-h-[40px] bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setResetting(u)}
                  aria-label="Parolni tiklash"
                  className="min-w-[40px] min-h-[40px] bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl flex items-center justify-center transition-colors"
                >
                  <KeyRound size={14} />
                </button>
                {(u.status === 'active' || u.status === 'inactive') && (
                  <button
                    onClick={() => toggleStatus(u)}
                    className={`min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-colors ${
                      u.status === 'active'
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-[#94a3b8] bg-[#f7f4ef] hover:bg-[#ede9e1]'
                    }`}
                    title={
                      u.status === 'active' ? 'Faolsizlantirish' : 'Faollashtirish'
                    }
                  >
                    {u.status === 'active' ? (
                      <UserCheck size={16} />
                    ) : (
                      <UserX size={16} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setDeleting(u)}
                  aria-label="O'chirish"
                  title="O'chirish"
                  className="min-w-[40px] min-h-[40px] bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Foydalanuvchini tahrirlash"
        theme="light"
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="edit-uname"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Ism *
            </label>
            <input
              id="edit-uname"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              autoFocus
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-urole"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Rol
              </label>
              <select
                id="edit-urole"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value })
                }
                className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="edit-ubranch"
                className="block text-xs text-[#94a3b8] mb-1"
              >
                Filial
              </label>
              <select
                id="edit-ubranch"
                value={editForm.branchId}
                onChange={(e) =>
                  setEditForm({ ...editForm, branchId: e.target.value })
                }
                className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
              >
                <option value="">— yo‘q —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(editForm.role === 'student' || editForm.role === 'mentor') && (
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Guruh</label>
              <div className="relative">
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] pr-8"
                >
                  <option value="">— guruhsiz —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
              </div>
            </div>
          )}
          <div>
            <label
              htmlFor="edit-uphone"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Telefon
            </label>
            <input
              id="edit-uphone"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
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

      {/* Password reset modal */}
      <Modal
        open={resetting !== null}
        onClose={() => !resetSaving && setResetting(null)}
        title="Parolni tiklash"
        theme="light"
      >
        <p className="text-sm text-[#64748b] mb-3">
          <span className="font-semibold text-[#0f172a]">
            {resetting?.name}
          </span>{' '}
          uchun yangi parolni kiriting va foydalanuvchiga aytib qo‘ying.
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
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
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
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={deleting !== null}
        onClose={() => !deleteSaving && setDeleting(null)}
        title="Foydalanuvchini o'chirish"
        theme="light"
      >
        <p className="text-sm text-[#0f172a] mb-2">
          <span className="font-semibold">{deleting?.name}</span>
          {` (${deleting?.login ?? ''}) ni o’chirmoqchimisiz?`}
        </p>
        <p className="text-xs text-rose-600 mb-3">
          {'Bu amal qaytarilmaydi. Foydalanuvchining barcha bog’liq ma’lumotlari (darslar progressi, davomat, to’lovlar, ogohlantirishlar va h.k.) ham birga o’chiriladi.'}
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setDeleting(null)}
            disabled={deleteSaving}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={doDelete}
            disabled={deleteSaving}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50"
          >
            {deleteSaving ? "O'chirilmoqda..." : "Ha, o'chirish"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Pill-shaped filter chip used for role + branch filters. Tapping a chip
 * is one gesture — much faster than opening a dropdown, scrolling, and
 * selecting on mobile. Active state mirrors the violet accent the rest
 * of the superadmin panel uses.
 */
function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'px-3 py-1.5 min-h-[32px] rounded-full text-xs font-bold transition-colors border',
        active
          ? 'bg-violet-600 text-white border-violet-600'
          : 'bg-white text-[#0f172a] border-[#ede9e1] hover:border-violet-300 hover:bg-violet-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
