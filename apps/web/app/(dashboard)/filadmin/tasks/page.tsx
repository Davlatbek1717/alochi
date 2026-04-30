'use client';
import { useEffect, useState } from 'react';
import { Plus, ClipboardList, CheckCircle, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, useToast } from '@/components/ui';

type Task = {
  id: string; title: string; description?: string; status: string;
  kpiBall: number; deadline?: string; createdAt: string;
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

export default function FiladminTasksPage() {
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<'sent' | 'my'>('sent');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assignedTo: '', title: '', description: '', kpiBall: 0, deadline: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function fetchTasks() {
    setLoading(true);
    try {
      const res = await apiRequest<Task[]>(tab === 'sent' ? '/tasks/sent' : '/tasks/my', {}, token());
      setTasks(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchTasks(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createTask() {
    if (!form.title.trim() || !form.assignedTo.trim()) { setFormError('Sarlavha va bajaruvchi kerak'); return; }
    setSaving(true); setFormError('');
    try {
      const res = await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...form, kpiBall: Number(form.kpiBall) }),
      }, token());
      setTasks((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({ assignedTo: '', title: '', description: '', kpiBall: 0, deadline: '' });
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

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Filadmin</p>
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
        {/* Create form */}
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
              <input
                placeholder="Bajaruvchi ID *"
                aria-label="Bajaruvchi ID"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
              />
              <textarea
                placeholder="Tavsif (ixtiyoriy)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="KPI ball"
                  aria-label="KPI ball"
                  value={form.kpiBall}
                  onChange={(e) => setForm({ ...form, kpiBall: Number(e.target.value) })}
                  className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                />
                <input
                  type="date"
                  aria-label="Muddat"
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

        {/* Tabs */}
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

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
