'use client';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  ClipboardList,
  PlayCircle,
  CheckCircle,
  Plus,
  Trash2,
  Send,
  ArrowLeft,
  Star,
  User,
  Search,
  X as XIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  kpiBall: number;
  deadline?: string;
  creator?: { name: string };
  assignee?: { id: string; name: string };
  createdBy?: string;
};

type GroupStudent = {
  id: string;
  name: string;
  role: string;
  groupId?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi',
  seen: "Ko'rildi",
  in_progress: 'Jarayonda',
  done: 'Bajarildi',
  confirmed: 'Tasdiqlandi',
};

const STATUS_BADGE: Record<string, string> = {
  sent: 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]',
  seen: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed: 'bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/20',
};

const NEXT_STATUS: Record<string, string | null> = {
  sent: 'in_progress',
  seen: 'in_progress',
  in_progress: 'done',
  done: null,
  confirmed: null,
};

type FilterMode = 'all' | 'pending' | 'done';

export default function MentorTasksPage() {
  const { success, error: toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sentTasks, setSentTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'given'>('mine');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const [openCreate, setOpenCreate] = useState(false);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newAssignee, setNewAssignee] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newKpi, setNewKpi] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [myUserId, setMyUserId] = useState<string>('');

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        id?: string;
      };
      if (u.id) setMyUserId(u.id);
    } catch {
      /* keep empty */
    }
    Promise.all([
      apiRequest<Task[]>('/tasks/my', {}, token()).catch(() => ({
        data: [] as Task[],
      })),
      apiRequest<Task[]>('/tasks/sent', {}, token()).catch(() => ({
        data: [] as Task[],
      })),
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
      const profile = await apiRequest<{ groupId?: string | null }>(
        '/users/my-profile',
        {},
        token(),
      );
      const groupId = profile.data.groupId;
      if (!groupId) {
        toastError('Sizga guruh biriktirilmagan');
        setStudents([]);
        return;
      }
      const res = await apiRequest<GroupStudent[]>(
        `/users/group/${groupId}`,
        {},
        token(),
      );
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
    if (!newAssignee) {
      toastError("O'quvchini tanlang");
      return;
    }
    if (!newTitle.trim()) {
      toastError('Sarlavha kerak');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<Task>(
        '/tasks',
        {
          method: 'POST',
          body: JSON.stringify({
            assignedTo: newAssignee,
            title: newTitle.trim(),
            description: newDesc.trim() || undefined,
            kpiBall: newKpi || 0,
          }),
        },
        token(),
      );
      setSentTasks((prev) => [res.data, ...prev]);
      setOpenCreate(false);
      success('Vazifa yaratildi');
      setTab('given');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Yaratishda xato');
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
      const res = await apiRequest<Task>(
        `/tasks/${id}/confirm`,
        { method: 'PATCH' },
        token(),
      );
      setSentTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...res.data } : t)),
      );
      success('Tasdiqlandi');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Xato');
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await apiRequest<Task>(
        `/tasks/${id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
        token(),
      );
      setTasks((prev) => prev.map((t) => (t.id === id ? res.data : t)));
      success('Status yangilandi');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xato');
    }
  }

  const isMine = tab === 'mine';
  const sourceTasks = isMine ? tasks : sentTasks;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      const isPending = t.status !== 'done' && t.status !== 'confirmed';
      if (filter === 'pending' && !isPending) return false;
      if (
        filter === 'done' &&
        t.status !== 'done' &&
        t.status !== 'confirmed'
      )
        return false;
      return true;
    });
  }, [sourceTasks, search, filter]);

  const counts = useMemo(() => {
    const pending = sourceTasks.filter(
      (t) => t.status !== 'done' && t.status !== 'confirmed',
    ).length;
    const done = sourceTasks.length - pending;
    return { all: sourceTasks.length, pending, done };
  }, [sourceTasks]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mentor"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                Mentor
              </p>
              <p className="text-white text-lg font-extrabold leading-tight">
                Vazifalar
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Plus size={14} /> Yangi
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#162032] rounded-xl p-1 border border-white/5">
            <button
              type="button"
              onClick={() => {
                setTab('mine');
                setFilter('all');
                setSearch('');
              }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-colors ${
                isMine ? 'bg-white text-[#0f172a]' : 'text-[#94a3b8]'
              }`}
            >
              Menga ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('given');
                setFilter('all');
                setSearch('');
              }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-colors ${
                !isMine ? 'bg-white text-[#0f172a]' : 'text-[#94a3b8]'
              }`}
            >
              Berilgan ({sentTasks.length})
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">
        {/* Search + filter chips */}
        {!loading && sourceTasks.length > 0 && (
          <>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Vazifa nomi bo'yicha qidirish..."
                className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-amber-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Qidiruvni tozalash"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
              {(
                [
                  { key: 'all', label: 'Hammasi', count: counts.all },
                  { key: 'pending', label: 'Kutilmoqda', count: counts.pending },
                  { key: 'done', label: 'Bajarilgan', count: counts.done },
                ] as { key: FilterMode; label: string; count: number }[]
              ).map((f) => {
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                    }`}
                  >
                    {f.label}
                    <span
                      className={isActive ? 'text-white/80' : 'text-[#94a3b8]'}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2"
              >
                <Skeleton theme="light" className="h-4 w-2/3" />
                <Skeleton theme="light" className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : sourceTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={isMine ? <ClipboardList size={28} /> : <Send size={28} />}
              title={isMine ? "Vazifalar yo'q" : 'Hali vazifa bermadingiz'}
              description={
                isMine
                  ? 'Sizga hali vazifa yuklanmagan'
                  : '"Yangi" tugmasi orqali yarating'
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-sm font-extrabold text-[#0f172a]">
              Filtrga mos vazifa topilmadi
            </p>
            <p className="text-xs text-[#64748b] mt-1">
              Qidiruv yoki filtrni o&apos;zgartiring
            </p>
          </div>
        ) : isMine ? (
          <ul className="space-y-2">
            {filtered.map((t) => {
              const next = NEXT_STATUS[t.status];
              return (
                <li
                  key={t.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2.5"
                >
                  <div className="flex items-start gap-2 justify-between">
                    <p className="font-extrabold text-[#0f172a] text-sm flex-1 leading-snug">
                      {t.title}
                    </p>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                        STATUS_BADGE[t.status] ?? STATUS_BADGE.sent
                      }`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-[#64748b] leading-relaxed">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[#64748b] font-bold">
                      <User size={11} />
                      {t.creator?.name ?? '—'}
                    </span>
                    {t.kpiBall > 0 && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-extrabold">
                        <Star size={10} />
                        {t.kpiBall} KPI
                      </span>
                    )}
                  </div>
                  {next && (
                    <Button
                      variant={next === 'done' ? 'success' : 'secondary'}
                      fullWidth
                      size="sm"
                      icon={
                        next === 'done' ? (
                          <CheckCircle size={14} />
                        ) : (
                          <PlayCircle size={14} />
                        )
                      }
                      onClick={() => updateStatus(t.id, next)}
                    >
                      {next === 'done' ? 'Bajarildi' : 'Boshlash'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-2">
            {filtered.map((t) => {
              const canEdit = t.status === 'sent';
              const canConfirm = t.status === 'done';
              return (
                <li
                  key={t.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 space-y-2.5"
                >
                  <div className="flex items-start gap-2 justify-between">
                    <p className="font-extrabold text-[#0f172a] text-sm flex-1 leading-snug">
                      {t.title}
                    </p>
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                        STATUS_BADGE[t.status] ?? STATUS_BADGE.sent
                      }`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-[#64748b] leading-relaxed">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[#64748b] font-bold">
                      <User size={11} />
                      {t.assignee?.name ?? '—'}
                    </span>
                    {t.kpiBall > 0 && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-extrabold">
                        <Star size={10} />
                        {t.kpiBall} KPI
                      </span>
                    )}
                  </div>
                  {(canConfirm || canEdit) && (
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
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Yangi vazifa"
        description="O'quvchi uchun vazifa yarating"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              Bekor qilish
            </Button>
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
            <label className="block text-xs font-extrabold text-[#64748b] mb-1.5 uppercase tracking-wide">
              O&apos;quvchi
            </label>
            {studentsLoading ? (
              <div className="text-xs text-[#94a3b8]">Yuklanmoqda...</div>
            ) : students.length === 0 ? (
              <p className="text-xs text-[#94a3b8]">Guruhda o&apos;quvchi yo&apos;q</p>
            ) : (
              <select
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-amber-400"
              >
                <option value="">— tanlang —</option>
                {students
                  .filter((s) => s.id !== myUserId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#64748b] mb-1.5 uppercase tracking-wide">
              Sarlavha
            </label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Masalan: 5 yangi so'z yodlash"
              maxLength={140}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#64748b] mb-1.5 uppercase tracking-wide">
              Tavsif (ixtiyoriy)
            </label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={500}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] placeholder-[#94a3b8] resize-none focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-[#64748b] mb-1.5 uppercase tracking-wide">
              KPI ball (ixtiyoriy, 0–50)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={newKpi}
              onChange={(e) =>
                setNewKpi(
                  Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                )
              }
              className="w-24 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
