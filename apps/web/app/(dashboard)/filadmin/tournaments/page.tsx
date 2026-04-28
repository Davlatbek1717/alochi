'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trophy, Users, Calendar, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Tournament = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  _count?: { registrations: number };
};

export default function FiladminTournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'individual', startsAt: '', endsAt: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';

  useEffect(() => {
    apiRequest<Tournament[]>('/tournaments', {}, token)
      .then((res) => setTournaments(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<Tournament>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(form),
      }, token);
      setTournaments((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({ title: '', type: 'individual', startsAt: '', endsAt: '' });
    } catch {
      // keep form open on error
    }
    setSubmitting(false);
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <button
          onClick={() => router.push('/filadmin')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-4 relative z-10"
        >
          <ArrowLeft size={16} /> Bosh sahifaga
        </button>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-[#f59e0b]" />
              <span className="text-[#f59e0b] text-xs font-semibold uppercase tracking-wider">Turnirlar</span>
            </div>
            <p className="text-white text-xl font-bold">Turnir boshqaruvi</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-[#f59e0b] text-[#0f172a] text-sm font-bold px-4 py-2 rounded-xl"
          >
            <Plus size={16} /> Yangi
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1] space-y-3">
            <p className="font-bold text-[#0f172a] text-sm mb-1">Yangi turnir yaratish</p>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Turnir nomi"
              className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b] bg-white"
            >
              <option value="individual">Individual</option>
              <option value="team">Jamoaviy</option>
              <option value="group">Guruh</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Boshlanish</label>
                <input
                  required
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
                />
              </div>
              <div>
                <label className="text-xs text-[#64748b] mb-1 block">Tugash</label>
                <input
                  required
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 border border-[#ede9e1] text-[#64748b] py-2.5 rounded-xl text-sm font-semibold"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#f59e0b] text-[#0f172a] py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1] animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white rounded-[18px] p-10 text-center border-[1.5px] border-[#ede9e1]">
            <Trophy size={40} className="text-[#f59e0b] mx-auto mb-3" />
            <p className="text-[#0f172a] font-semibold">Hali turnirlar yo&apos;q</p>
            <p className="text-[#64748b] text-sm mt-1">Birinchi turnirni yarating</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/filadmin/tournaments/${t.id}`)}
                className="w-full bg-white rounded-[18px] px-4 py-3.5 border-[1.5px] border-[#ede9e1] flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
                  <Trophy size={18} className="text-[#f59e0b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] font-bold text-sm truncate">{t.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]">
                      {t.type}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                      <Calendar size={10} /> {formatDate(t.startsAt)}
                    </span>
                    {t._count && (
                      <span className="flex items-center gap-1 text-[11px] text-[#94a3b8]">
                        <Users size={10} /> {t._count.registrations}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
