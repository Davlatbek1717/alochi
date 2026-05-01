'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, PlayCircle, CheckCircle, Plus, Trash2, Send } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Task = {
  id: string; title: string; description?: string; status: string;
  kpiBall: number; deadline?: string; creator?: { name: string };
  assignee?: { id: string; name: string };
  createdBy?: string;
};

type GroupStudent = { id: string; name: string; role: string; groupId?: string | null };

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

const NEXT_STATUS: Record<string, string | null> = {
  sent: 'in_progress', seen: 'in_progress', in_progress: 'done', done: null, confirmed: null,
};

export default function MentorTasksPage() {
  const { success, error: toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sentTasks, setSentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'given'>('mine');

  const [openCreate, setOpenCreate] = useState(false);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newAssignee, setNewAssignee] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newKpi, setNewKpi] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [myUserId, setMyUserId] = useState<string>('');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string };
      if (u.id) setMyUserId(u.id);
    } catch { /* keep empty */ }
    Promise.all([
      apiRequest<Task[]>('/tasks/my', {}, token()).catch(() => ({ data: [] as Task[] })),
      apiRequest<Task[]>('/tasks/sent', {}, token()).catch(() => ({ data: [] as Task[] })),
    ])
      .then(([mine, sent]) => {
        setTasks(mine.data);
        setSentTasks(sent.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadStudents() {
    setStudentsLoading(true);
    try {
      // Resolve mentor's groupId via /users/my-profile
      const profile = await apiRequest<{ groupId?: string | null }>('/users/my-profile', {}, token());
      const groupId = profile.data.groupId;
      if (!groupId) {
        toastError("Sizga guruh biriktirilmagan");
        setStudents([]);
        return;
      }
      const res = await apiRequest<GroupStudent[]>(`/users/group/${groupId}`, {}, token());
      setStudents(res.data.filter((u) => u.role === 'student'));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "O'quvchilar yuklanmadi");
    } finally {
      setStudentsLoading(false);
    }
  }

  function openCreateModal() {
    setOpenCreate(true);
    setNewAssignee('');
    setNewTitle('');
    setNewDesc('');
    setNewKpi(0);
    if (students.length === 0) loadStudents();
  }

  async function submitCreate() {
    if (!newAssignee) { toastError("O'quvchini tanlang"); return; }
    if (!newTitle.trim()) { toastError("Sarlavha kerak"); return; }
    setSubmitting(true);
    try {
      const res = await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          assignedTo: newAssignee,
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          kpiBall: newKpi || 0,
        }),
      }, token());
      setSentTasks((prev) => [res.data, ...prev]);
      setOpenCreate(false);
      success("Vazifa yaratildi");
      setTab('given');
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Yaratishda xato");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("Vazifani o'chirishni tasdiqlaysizmi?")) return;
    try {
      await apiRequest(`/tasks/${id}`, { method: 'DELETE' }, token());
      setSentTasks((prev) => prev.filter((t) => t.id !== id));
      success("O'chirildi");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "O'chirishda xato");
    }
  }

  async function confirmTask(id: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/confirm`, { method: 'PATCH' }, token());
      setSentTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...res.data } : t));
      success("Tasdiqlandi");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Xato");
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
      success('Status yangilandi');
    } catch (err) { toastError(err instanceof Error ? err.message : 'Xato'); }
  }

  const isMine = tab === 'mine';

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Mentor</p>
            <p className="text-white text-xl font-bold">Vazifalar</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-[#0d9488] hover:bg-[#0f766e] text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} /> Yangi vazifa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 bg-white rounded-xl p-1 border-[1.5px] border-[#ede9e1]">
          <button
            onClick={() => setTab('mine')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${isMine ? 'bg-[#0f172a] text-white' : 'text-[#64748b]'}`}
          >
            Mening vazifalarim
          </button>
          <button
            onClick={() => setTab('given')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${!isMine ? 'bg-[#0f172a] text-white' : 'text-[#64748b]'}`}
          >
            Berilgan ({sentTasks.length})
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <Skeleton theme="light" className="h-4 w-2/3" />
                <Skeleton theme="light" className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : isMine ? (
          tasks.length === 0 ? (
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
              <EmptyState theme="light" icon={<ClipboardList size={28} />} title="Vazifalar yo'q" description="Sizga hali vazifalar yuklanmagan" />
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const next = NEXT_STATUS[t.status];
                return (
                  <div key={t.id} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                    <div className="flex items-start gap-2 justify-between">
                      <p className="font-semibold text-[#0f172a] text-sm flex-1">{t.title}</p>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[t.status] ?? STATUS_BADGE.sent}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    {t.description && <p className="text-xs text-[#64748b]">{t.description}</p>}
                    <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                      <span>{t.creator?.name}</span>
                      {t.kpiBall > 0 && <span className="bg-[#f7f4ef] px-2 py-0.5 rounded-full">{t.kpiBall} KPI</span>}
                    </div>
                    {next && (
                      <Button
                        variant={next === 'done' ? 'success' : 'secondary'}
                        fullWidth
                        size="sm"
                        icon={next === 'done' ? <CheckCircle size={14} /> : <PlayCircle size={14} />}
                        onClick={() => updateStatus(t.id, next)}
                      >
                        {next === 'done' ? 'Bajarildi' : 'Boshlash'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : sentTasks.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState theme="light" icon={<Send size={28} />} title="Hali bermadingiz" description="“Yangi vazifa” tugmasi orqali yarating" />
          </div>
        ) : (
          <div className="space-y-2">
            {sentTasks.map((t) => {
              const canEdit = t.status === 'sent';
              const canConfirm = t.status === 'done';
              return (
                <div key={t.id} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="font-semibold text-[#0f172a] text-sm flex-1">{t.title}</p>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[t.status] ?? STATUS_BADGE.sent}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-[#64748b]">{t.description}</p>}
                  <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                    <span>O&apos;quvchi: {t.assignee?.name ?? '—'}</span>
                    {t.kpiBall > 0 && <span className="bg-[#f7f4ef] px-2 py-0.5 rounded-full">{t.kpiBall} KPI</span>}
                  </div>
                  <div className="flex gap-2">
                    {canConfirm && (
                      <Button
                        variant="success"
                        size="sm"
                        icon={<CheckCircle size={14} />}
                        onClick={() => confirmTask(t.id)}
                      >
                        Tasdiqlash
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => deleteTask(t.id)}
                      >
                        O&apos;chirish
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Yangi vazifa"
        description="O'quvchi uchun vazifa yarating"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Bekor qilish</Button>
            <Button
              variant="primary"
              onClick={submitCreate}
              loading={submitting}
              disabled={submitting}
            >
              Yuborish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">O&apos;quvchi</label>
            {studentsLoading ? (
              <div className="text-xs text-slate-400">Yuklanmoqda...</div>
            ) : students.length === 0 ? (
              <p className="text-xs text-slate-400">Guruhda o&apos;quvchi yo&apos;q</p>
            ) : (
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
              >
                <option value="">— tanlang —</option>
                {students.filter((s) => s.id !== myUserId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Sarlavha</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Masalan: 5 yangi so'z yodlash"
              maxLength={140}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Tavsif (ixtiyoriy)</label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={500}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">KPI ball (ixtiyoriy)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={newKpi}
              onChange={(e) => setNewKpi(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
