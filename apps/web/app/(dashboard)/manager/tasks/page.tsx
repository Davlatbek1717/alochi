'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  kpiBall: number;
  deadline?: string;
  createdAt: string;
  assignee?: { name: string };
  creator?: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi',
  seen: "Ko'rildi",
  in_progress: 'Jarayonda',
  done: 'Bajarildi',
  confirmed: 'Tasdiqlandi',
};

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-gray-100 text-gray-600',
  seen: 'bg-blue-100 text-blue-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
};

export default function ManagerTasksPage() {
  const [tab, setTab] = useState<'sent' | 'my'>('sent');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assignedTo: '', title: '', description: '', kpiBall: 0, deadline: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function fetchTasks() {
    setLoading(true);
    try {
      const url = tab === 'sent' ? '/tasks/sent' : '/tasks/my';
      const res = await apiRequest<Task[]>(url, {}, token());
      setTasks(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchTasks(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createTask() {
    if (!form.title.trim() || !form.assignedTo.trim()) { setError('Sarlavha va bajaruvchi kerak'); return; }
    setSaving(true); setError('');
    try {
      const res = await apiRequest<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...form, kpiBall: Number(form.kpiBall) }),
      }, token());
      setTasks((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({ assignedTo: '', title: '', description: '', kpiBall: 0, deadline: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato');
    } finally { setSaving(false); }
  }

  async function confirmTask(id: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/confirm`, { method: 'PATCH' }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
    } catch (err) { alert(err instanceof Error ? err.message : 'Xato'); }
  }

  async function updateMyStatus(id: string, status: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
    } catch (err) { alert(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Vazifalar</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-xl font-medium">
          + Yaratish
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input placeholder="Sarlavha *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <input placeholder="Bajaruvchi ID *" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <textarea placeholder="Tavsif (ixtiyoriy)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={2} />
          <div className="flex gap-2">
            <input type="number" placeholder="KPI ball" value={form.kpiBall} onChange={(e) => setForm({ ...form, kpiBall: Number(e.target.value) })}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
          </div>
          <button onClick={createTask} disabled={saving}
            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saqlanmoqda...' : 'Yuborish'}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {(['sent', 'my'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t === 'sent' ? 'Yuborilgan' : 'Kelgan'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Yuklanmoqda...</p>
      ) : tasks.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Vazifalar yo&apos;q</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 text-sm">{t.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </div>
              {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{tab === 'sent' ? t.assignee?.name : t.creator?.name}</span>
                <span>{t.kpiBall > 0 ? `${t.kpiBall} KPI` : ''}</span>
              </div>
              {tab === 'sent' && t.status === 'done' && (
                <button onClick={() => confirmTask(t.id)}
                  className="w-full bg-green-600 text-white py-1.5 rounded-xl text-xs font-semibold">
                  Tasdiqlash ✓
                </button>
              )}
              {tab === 'my' && t.status === 'sent' && (
                <button onClick={() => updateMyStatus(t.id, 'in_progress')}
                  className="w-full bg-blue-600 text-white py-1.5 rounded-xl text-xs font-semibold">
                  Boshlash
                </button>
              )}
              {tab === 'my' && t.status === 'in_progress' && (
                <button onClick={() => updateMyStatus(t.id, 'done')}
                  className="w-full bg-green-600 text-white py-1.5 rounded-xl text-xs font-semibold">
                  Bajarildi ✓
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
