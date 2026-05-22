'use client';
import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp, X, UserPlus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Branch = { id: string; name: string };
type Mentor = { id: string; name: string };
type GroupItem = {
  id: string;
  name: string;
  branchId: string;
  mentorId: string | null;
  mentor: Mentor | null;
  studentCount: number;
  branch?: { id: string; name: string };
};
type BranchUser = { id: string; name: string; role: string; branchId: string | null; groupId: string | null };

function emptyForm() {
  return { branchId: '', name: '', mentorId: '' };
}

export default function SuperadminGroupsPage() {
  const toast = useToast();
  const [allGroups, setAllGroups] = useState<GroupItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allUsers, setAllUsers] = useState<BranchUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [branchFilter, setBranchFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<GroupItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [addingStudents, setAddingStudents] = useState(false);

  const token = () =>
    typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupsRes, branchesRes, usersRes] = await Promise.all([
        apiRequest<GroupItem[]>('/groups/all', {}, token()),
        apiRequest<Branch[]>('/branches', {}, token()),
        apiRequest<BranchUser[]>('/users', {}, token()),
      ]);
      setAllGroups(groupsRes.data ?? []);
      setBranches(branchesRes.data ?? []);
      setAllUsers(usersRes.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useFocusRevalidate(load);

  const filteredGroups = branchFilter
    ? allGroups.filter((g) => g.branchId === branchFilter)
    : allGroups;

  function mentorsForBranch(branchId: string, excludeGroupId?: string) {
    const leadingIds = new Set(
      allGroups
        .filter((g) => g.mentorId && g.id !== (excludeGroupId ?? ''))
        .map((g) => g.mentorId as string),
    );
    return allUsers
      .filter((u) => u.role === 'mentor' && u.branchId === branchId && !leadingIds.has(u.id))
      .map((u) => ({ id: u.id, name: u.name }));
  }

  function studentsInGroup(groupId: string) {
    return allUsers.filter((u) => u.role === 'student' && u.groupId === groupId);
  }

  function studentsWithoutGroupInBranch(branchId: string) {
    return allUsers.filter((u) => u.role === 'student' && u.branchId === branchId && !u.groupId);
  }

  async function handleCreate() {
    if (!form.branchId) { toast.error('Filial tanlang'); return; }
    if (!form.name.trim()) { toast.error('Guruh nomi kerak'); return; }
    setSaving(true);
    try {
      await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({ branchId: form.branchId, name: form.name.trim(), mentorId: form.mentorId || undefined }),
      }, token());
      toast.success('Guruh yaratildi');
      setShowCreate(false);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(g: GroupItem) {
    setEditTarget(g);
    setForm({ branchId: g.branchId, name: g.name, mentorId: g.mentorId ?? '' });
  }

  async function handleEdit() {
    if (!editTarget) return;
    if (!form.name.trim()) { toast.error('Guruh nomi kerak'); return; }
    setSaving(true);
    try {
      await apiRequest(`/groups/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: form.name.trim(), mentorId: form.mentorId || null }),
      }, token());
      toast.success('Saqlandi');
      setEditTarget(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/groups/${deleteTarget.id}`, { method: 'DELETE' }, token());
      toast.success("Guruh o'chirildi");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  async function removeStudent(groupId: string, studentId: string) {
    try {
      await apiRequest(`/groups/${groupId}/students/${studentId}`, { method: 'DELETE' }, token());
      toast.success("O'quvchi guruhdan chiqarildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function handleAddStudents() {
    if (!pickerGroup || pickerSelected.length === 0) return;
    setAddingStudents(true);
    try {
      await apiRequest(`/groups/${pickerGroup}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentIds: pickerSelected }),
      }, token());
      toast.success("O'quvchilar qo'shildi");
      setPickerGroup(null);
      setPickerSelected([]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setAddingStudents(false);
    }
  }

  const pickerBranchId = pickerGroup ? (allGroups.find((g) => g.id === pickerGroup)?.branchId ?? '') : '';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div aria-hidden className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white text-lg font-bold">Guruhlar</p>
              <p className="text-[#64748b] text-xs">Barcha filiallardagi guruhlar</p>
            </div>
          </div>
          <button
            onClick={() => { setShowCreate(true); setForm(emptyForm()); }}
            className="flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={15} />
            Yangi guruh
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* Branch filter */}
        <div className="relative inline-flex items-center">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="appearance-none bg-white border border-[#ede9e1] rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          >
            <option value="">Barcha filiallar</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 text-[#94a3b8] pointer-events-none" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" theme="light" />)}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState icon={<Users size={28} />} title="Guruhlar yoʻq" description="Yangi guruh yarating" theme="light" />
          </div>
        ) : (
          filteredGroups.map((g) => {
            const isExpanded = expanded[g.id] ?? false;
            const inGroup = studentsInGroup(g.id);
            const branchName = g.branch?.name ?? branches.find((b) => b.id === g.branchId)?.name ?? '';
            return (
              <div key={g.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#0f172a] font-bold text-base truncate">{g.name}</p>
                      {branchName && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{branchName}</span>
                      )}
                    </div>
                    <p className="text-[#64748b] text-xs mt-0.5">
                      Mentor: {g.mentor?.name ?? <span className="text-rose-500 font-semibold">Tayinlanmagan</span>}
                    </p>
                    <p className="text-[#94a3b8] text-xs mt-0.5">{g.studentCount} ta oʻquvchi</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(g)} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-violet-50 hover:border-violet-200 transition-colors" title="Tahrirlash"><Pencil size={13} className="text-[#64748b]" /></button>
                    <button onClick={() => setDeleteTarget(g)} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-rose-50 hover:border-rose-200 transition-colors" title="O'chirish"><Trash2 size={13} className="text-[#94a3b8]" /></button>
                    <button onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isExpanded }))} className="w-8 h-8 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center hover:bg-[#ede9e1] transition-colors">{isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#ede9e1] px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Oʻquvchilar</p>
                      <button onClick={() => { setPickerGroup(g.id); setPickerSelected([]); }} className="flex items-center gap-1.5 text-xs font-bold text-[#7c3aed] hover:underline"><UserPlus size={12} />Qoʻshish</button>
                    </div>
                    {inGroup.length === 0 ? (
                      <p className="text-xs text-[#94a3b8] italic">Guruhda oʻquvchi yoʻq</p>
                    ) : (
                      inGroup.map((s) => (
                        <div key={s.id} className="flex items-center justify-between bg-[#f7f4ef] rounded-xl px-3 py-2">
                          <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                          <button onClick={() => removeStudent(g.id, s.id)} className="text-[#94a3b8] hover:text-rose-500 transition-colors"><X size={14} /></button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Yangi guruh" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Filial</label>
            <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, mentorId: '' })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
              <option value="">— tanlang —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Guruh nomi</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Guruh A" className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]" />
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Mentor (ixtiyoriy)</label>
            {form.branchId ? (
              mentorsForBranch(form.branchId).length === 0 ? (
                <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mentor mavjud emas</p>
              ) : (
                <select value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
                  <option value="">— tayinlanmagan —</option>
                  {mentorsForBranch(form.branchId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )
            ) : <p className="text-xs text-[#94a3b8] italic">Avval filial tanlang</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
            <button onClick={() => setShowCreate(false)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Guruhni tahrirlash">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Guruh nomi</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]" />
          </div>
          <div>
            <label className="block text-xs text-[#94a3b8] mb-1">Mentor</label>
            {editTarget && mentorsForBranch(editTarget.branchId, editTarget.id).length === 0 && !editTarget.mentorId ? (
              <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Mentor mavjud emas</p>
            ) : (
              <select value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })} className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]">
                <option value="">— tayinlanmagan —</option>
                {editTarget && [
                  ...(editTarget.mentor ? [editTarget.mentor] : []),
                  ...mentorsForBranch(editTarget.branchId, editTarget.id).filter((m) => m.id !== editTarget.mentorId),
                ].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleEdit} disabled={saving} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-50">{saving ? 'Saqlanmoqda...' : 'Saqlash'}</button>
            <button onClick={() => setEditTarget(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Guruhni o'chirish">
        <p className="text-[#64748b] text-sm mb-4"><span className="font-bold text-[#0f172a]">{deleteTarget?.name}</span> guruhini oʻchirishni tasdiqlaysizmi?</p>
        {deleteTarget && deleteTarget.studentCount > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-rose-700 text-sm font-semibold">Guruhda {deleteTarget.studentCount} ta oʻquvchi bor. Avval ularni chiqaring.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleDelete} disabled={deleting || (deleteTarget?.studentCount ?? 0) > 0} className="bg-rose-600 text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40">{deleting ? 'Oʻchirilmoqda...' : "O'chirish"}</button>
          <button onClick={() => setDeleteTarget(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
        </div>
      </Modal>

      {/* Add students picker */}
      <Modal open={!!pickerGroup} onClose={() => setPickerGroup(null)} title="Oʻquvchi qoʻshish" size="lg">
        <div className="space-y-3">
          {studentsWithoutGroupInBranch(pickerBranchId).length === 0 ? (
            <p className="text-sm text-[#64748b] italic">Guruhsiz oʻquvchi yoʻq</p>
          ) : (
            studentsWithoutGroupInBranch(pickerBranchId).map((s) => {
              const checked = pickerSelected.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-violet-50 transition-colors">
                  <input type="checkbox" checked={checked} onChange={() => setPickerSelected((p) => checked ? p.filter((x) => x !== s.id) : [...p, s.id])} className="accent-[#7c3aed] w-4 h-4" />
                  <span className="text-sm text-[#0f172a] font-semibold">{s.name}</span>
                </label>
              );
            })
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={handleAddStudents} disabled={addingStudents || pickerSelected.length === 0} className="bg-[#0f172a] text-white text-sm px-4 py-2 rounded-xl font-bold disabled:opacity-40">{addingStudents ? 'Qoʻshilmoqda...' : `${pickerSelected.length} ta qoʻshish`}</button>
            <button onClick={() => setPickerGroup(null)} className="text-sm text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold">Bekor</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
