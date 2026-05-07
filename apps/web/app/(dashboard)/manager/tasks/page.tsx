'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, ClipboardList, CheckCircle, X, PlayCircle, Trash2, Pencil,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button, Card, CardHeader, CardTitle,
  EmptyState, Modal, Skeleton, useToast,
} from '@/components/ui';
import { getBranchIdFromToken } from '@/lib/jwt';

type Assignee = { id: string; name: string; role: string; groupId?: string | null };
type Task = {
  id: string; title: string; description?: string; status: string;
  kpiBall: number; deadline?: string; createdAt: string; assignedTo?: string;
  assignee?: { name: string }; creator?: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi', seen: "Ko'rildi", in_progress: 'Jarayonda', done: 'Bajarildi', confirmed: 'Tasdiqlandi',
};
const STATUS_BADGE: Record<string, string> = {
  sent:        'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]',
  seen:        'bg-blue-50 text-blue-600 border border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border border-amber-200',
  done:        'bg-emerald-50 text-emerald-600 border border-emerald-200',
  confirmed:   'bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20',
};

function getMe() {
  return { branchId: getBranchIdFromToken() ?? '' };
}

function emptyForm() {
  return { assignedTo: '', title: '', description: '', kpiBall: 0, deadline: '' };
}

export default function ManagerTasksPage() {
  const { success, error: toastError } = useToast();
  const me = useMemo(() => getMe(), []);
  const [tab, setTab] = useState<'sent' | 'my'>('sent');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [editing, setEditing] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await apiRequest<Task[]>(tab === 'sent' ? '/tasks/sent' : '/tasks/my', {}, token());
      setTasks(res.data);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Vazifalar yuklanmadi");
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchTasks(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Manager scope: own branch students for assigning
    if (!me.branchId) return;
    apiRequest<Assignee[]>(`/users/by-branch/${me.branchId}`, {}, token())
      .then((r) => setAssignees(r.data.filter((u) => u.role === 'student')))
      .catch(() => setAssignees([]));
  }, [me.branchId]);

  async function createTask() {
    if (!form.title.trim() || !form.assignedTo.trim()) {
      setFormError("Sarlavha va o'quvchi kerak");
      return;
    }
    const kpiBallNum = Number(form.kpiBall);
    if (isNaN(kpiBallNum) || kpiBallNum < 0) {
      setFormError("KPI ball noto'g'ri");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const res = await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...form, kpiBall: Number(form.kpiBall) }),
      }, token());
      setTasks((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      success('Vazifa yaratildi');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Xato');
    } finally { setSaving(false); }
  }

  async function confirmTask(id: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/confirm`, { method: 'PATCH' }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
      success('Vazifa tasdiqlandi');
    } catch (err) { toastError(err instanceof Error ? err.message : 'Xato'); }
  }

  async function updateMyStatus(id: string, status: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
      success('Status yangilandi');
    } catch (err) { toastError(err instanceof Error ? err.message : 'Xato'); }
  }

  function startEdit(t: Task) {
    setEditing(t);
    setEditForm({
      assignedTo: t.assignedTo ?? '',
      title: t.title,
      description: t.description ?? '',
      kpiBall: t.kpiBall ?? 0,
      deadline: t.deadline ? t.deadline.slice(0, 10) : '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.title.trim()) { toastError('Sarlavha kerak'); return; }
    setEditSaving(true);
    try {
      const res = await apiRequest<Task>(`/tasks/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          kpiBall: Number(editForm.kpiBall),
          deadline: editForm.deadline || null,
        }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === editing.id ? { ...t, ...res.data } : t));
      success('Saqlandi');
      setEditing(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setEditSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/tasks/${deleteTarget.id}`, { method: 'DELETE' }, token());
      setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      success("O'chirildi");
      setDeleteTarget(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xato');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Manager</p>
            <p className="text-white text-xl font-bold">Vazifalar</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={showForm ? <X size={16} /> : <Plus size={16} />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Yopish' : 'Yaratish'}
          </Button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Yangi vazifa</CardTitle>
            </CardHeader>
            <div className="space-y-3 p-4">
              {formError && <p className="text-sm text-rose-500">{formError}</p>}
              <input
                placeholder="Sarlavha *"
                aria-label="Vazifa sarlavhasi"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
              />
              <select
                aria-label="O'quvchi"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
              >
                <option value="">O&apos;quvchini tanlang...</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <textarea
                placeholder="Tavsif (ixtiyoriy)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] resize-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="KPI ball"
                  aria-label="KPI ball"
                  min={0}
                  value={form.kpiBall}
                  onChange={(e) => setForm({ ...form, kpiBall: Number(e.target.value) })}
                  className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                />
                <input
                  type="date"
                  aria-label="Muddat"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                />
              </div>
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                onClick={createTask}
              >
                {saving ? 'Saqlanmoqda...' : 'Yuborish'}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(['sent', 'my'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                tab === t ? 'bg-[#0f172a] text-white' : 'bg-white text-[#64748b] border border-[#ede9e1]'
              }`}
            >
              {t === 'sent' ? 'Yuborilgan' : 'Kelgan'}
            </button>
          ))}
        </div>

        {!me.branchId && !loading ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-rose-800">Filial biriktirilmagan</p>
            <p className="mt-1 text-sm text-rose-700">
              Hisobingiz biror filialga biriktirilmagan. Superadmin orqali filial tayinlanishini so&apos;rang.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <Skeleton theme="light" className="h-4 w-2/3" />
                <Skeleton theme="light" className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<ClipboardList size={28} />}
              title="Vazifalar yo'q"
              description="Bu bo'limda hali vazifalar mavjud emas"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                <div className="flex items-start gap-2 justify-between">
                  <p className="font-semibold text-[#0f172a] text-sm flex-1">{t.title}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[t.status] ?? STATUS_BADGE.sent}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
                {t.description && <p className="text-xs text-[#64748b]">{t.description}</p>}
                <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                  <span>{tab === 'sent' ? t.assignee?.name : t.creator?.name}</span>
                  {t.kpiBall > 0 && <span className="bg-[#f7f4ef] px-2 py-0.5 rounded-full">{t.kpiBall} KPI</span>}
                </div>
                {tab === 'sent' && t.status === 'done' && (
                  <Button
                    variant="success"
                    fullWidth
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    onClick={() => confirmTask(t.id)}
                  >
                    Tasdiqlash
                  </Button>
                )}
                {tab === 'sent' && t.status === 'sent' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(t)}
                      className="flex-1 text-xs font-semibold bg-[#f7f4ef] text-[#64748b] hover:bg-[#ede9e1] hover:text-[#0f172a] px-3 py-2 rounded-lg border border-[#ede9e1] inline-flex items-center justify-center gap-1.5"
                    >
                      <Pencil size={12} /> Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="flex-1 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-2 rounded-lg border border-rose-200 inline-flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} /> O&apos;chirish
                    </button>
                  </div>
                )}
                {tab === 'my' && t.status === 'sent' && (
                  <Button
                    variant="secondary"
                    fullWidth
                    size="sm"
                    icon={<PlayCircle size={14} />}
                    onClick={() => updateMyStatus(t.id, 'in_progress')}
                  >
                    Boshlash
                  </Button>
                )}
                {tab === 'my' && t.status === 'in_progress' && (
                  <Button
                    variant="success"
                    fullWidth
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    onClick={() => updateMyStatus(t.id, 'done')}
                  >
                    Bajarildi
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Vazifani tahrirlash"
        theme="light"
      >
        <div className="space-y-3">
          <input
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            placeholder="Sarlavha *"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          />
          <textarea
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            rows={3}
            placeholder="Tavsif"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="number"
              value={editForm.kpiBall}
              onChange={(e) => setEditForm({ ...editForm, kpiBall: Number(e.target.value) })}
              placeholder="KPI ball"
              className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
            <input
              type="date"
              value={editForm.deadline}
              onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
              className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#0f172a] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
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

      {/* Delete confirm */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Vazifa o'chirilsinmi?"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">{deleteTarget?.title}</span> o&apos;chirilsin? Bu amal qaytarib bo&apos;lmaydi.
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#0f172a] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
          >
            Yo&apos;q
          </button>
          <button
            onClick={doDelete}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "O'chirilmoqda..." : "Ha, o'chir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
