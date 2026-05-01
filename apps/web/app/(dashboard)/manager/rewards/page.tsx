'use client';
import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Reward = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  studentId: string;
  givenAt: string;
};

type Student = { id: string; name: string };

export default function ManagerRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState('gift');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function load() {
    try {
      const r = await apiRequest<Reward[]>('/manager-rewards', {}, token());
      setRewards(r.data);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let branchId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
      branchId = u.branchId ?? '';
    } catch { /* ignore */ }
    if (branchId) {
      apiRequest<Student[]>(`/users/by-branch/${branchId}?role=student`, {}, token())
        .then((r) => setStudents(r.data.filter((s: Student & { role?: string }) => (s as { role?: string }).role === 'student' || true)))
        .catch(() => setStudents([]));
    }
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !title) return;
    setSubmitting(true);
    setMsg('');
    try {
      await apiRequest(
        '/manager-rewards',
        {
          method: 'POST',
          body: JSON.stringify({ studentId, type, title, description }),
        },
        token(),
      );
      setMsg('Saqlandi');
      setTitle(''); setDescription('');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Gift size={20} className="text-amber-500" />
        <h1 className="text-xl font-bold text-[#0f172a]">Sovgʻa va Kitob</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm">
          <option value="">O&apos;quvchi tanlang</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm">
          <option value="gift">Sovgʻa</option>
          <option value="book">Kitob</option>
          <option value="other">Boshqa</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required
          placeholder="Nomi"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          placeholder="Izoh (ixtiyoriy)"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm" />
        <button disabled={submitting}
          className="w-full bg-[#0f172a] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
          {submitting ? 'Yuborilmoqda...' : 'Berish'}
        </button>
        {msg && <p className="text-xs text-[#0d9488]">{msg}</p>}
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Tarix</p>
        {rewards.length === 0 ? (
          <p className="text-[#64748b] text-sm">Hech narsa yoʻq</p>
        ) : (
          rewards.map((r) => (
            <div key={r.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3">
              <p className="text-sm font-semibold text-[#0f172a]">{r.title}</p>
              <p className="text-xs text-[#64748b]">{r.type} • {new Date(r.givenAt).toLocaleDateString('uz-UZ')}</p>
              {r.description && <p className="text-xs text-[#64748b] mt-1">{r.description}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
