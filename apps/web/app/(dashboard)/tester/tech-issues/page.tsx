'use client';
import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateTimeLong } from '@/lib/date-uz';

type Issue = {
  id: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  createdAt: string;
};

export default function TesterTechIssuesPage() {
  const [items, setItems] = useState<Issue[]>([]);
  const [category, setCategory] = useState('tablet');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  async function load() {
    try {
      const r = await apiRequest<Issue[]>('/tech-issues', {}, token());
      setItems(r.data);
    } catch { /* ignore */ }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description) return;
    setSubmitting(true); setMsg('');
    try {
      await apiRequest(
        '/tech-issues',
        { method: 'POST', body: JSON.stringify({ category, severity, description }) },
        token(),
      );
      setMsg('Yuborildi');
      setDescription('');
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Xatolik');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Wrench size={20} />
        <h1 className="text-xl font-bold text-[#0f172a]">Texnik muammo</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm">
          <option value="tablet">Planshet</option>
          <option value="audio">Mikrofon/Audio</option>
          <option value="camera">Kamera</option>
          <option value="network">Internet</option>
          <option value="other">Boshqa</option>
        </select>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm">
          <option value="low">Past</option>
          <option value="medium">Oʻrta</option>
          <option value="high">Yuqori</option>
        </select>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
          placeholder="Muammoni tasvirlab bering"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm" />
        <button disabled={submitting}
          className="w-full bg-[#0f172a] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
        {msg && <p className="text-xs text-[#0d9488]">{msg}</p>}
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Yuborilganlar</p>
        {items.length === 0 ? (
          <p className="text-[#64748b] text-sm">Roʻyxat boʻsh</p>
        ) : (
          items.map((i) => (
            <div key={i.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3">
              <div className="flex justify-between items-start">
                <p className="text-sm font-semibold text-[#0f172a]">{i.category}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  i.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {i.status}
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-1">{i.description}</p>
              <p className="text-xs text-[#94a3b8] mt-1">{formatDateTimeLong(i.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
