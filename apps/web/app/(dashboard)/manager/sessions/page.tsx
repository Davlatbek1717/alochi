'use client';
import { useEffect, useState } from 'react';
import { Calendar, Plus, Check, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';
import { formatDateTimeLong } from '@/lib/date-uz';

interface Session {
  id: string;
  studentId: string;
  scheduledAt: string;
  completedAt: string | null;
  notes: string | null;
  student?: { id: string; name: string };
}

interface Student {
  id: string;
  name: string;
  role?: string;
}

export default function ManagerSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  function load() {
    setLoading(true);
    apiRequest<Session[]>('/manager-sessions/mine', {}, token())
      .then((r) => setSessions(r.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    apiRequest<Student[]>('/users?role=student', {}, token())
      .then((r) => setStudents(r.data))
      .catch(() => setStudents([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !scheduledAt) {
      toast.error('Talaba va vaqt kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/manager-sessions',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            scheduledAt: new Date(scheduledAt).toISOString(),
            notes: notes || undefined,
          }),
        },
        token(),
      );
      setStudentId('');
      setScheduledAt('');
      setNotes('');
      load();
      toast.success('Sessiya rejalashtirildi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  async function complete(id: string) {
    try {
      await apiRequest(
        `/manager-sessions/${id}/complete`,
        { method: 'PATCH', body: JSON.stringify({}) },
        token(),
      );
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(
        `/manager-sessions/${deleteTarget.id}`,
        { method: 'DELETE' },
        token(),
      );
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('O‘chirildi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
            <Calendar size={20} className="text-[#0d9488]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Manager</p>
            <p className="text-white text-lg font-bold">1:1 Sessiyalar</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <form
          onSubmit={create}
          className="bg-white border-[1.5px] border-[#ede9e1] rounded-[18px] p-4 space-y-3"
        >
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">Talaba tanlang...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a]"
          />
          <textarea
            placeholder="Izoh (ixtiyoriy)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] placeholder-[#94a3b8]"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
          >
            <Plus size={14} /> {saving ? '...' : 'Rejalashtirish'}
          </button>
        </form>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} theme="light" className="h-16 w-full rounded-[18px]" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Calendar size={28} />}
              title="Hali sessiya yo‘q"
              description="Birinchi 1:1 sessiyani rejalashtiring"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isDone = Boolean(s.completedAt);
              return (
                <div
                  key={s.id}
                  className={`border-[1.5px] rounded-[18px] p-3 flex items-center justify-between gap-3 ${
                    isDone
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-white border-[#ede9e1]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0f172a] text-sm">
                      {s.student?.name ?? s.studentId}
                    </p>
                    <p className="text-xs text-[#64748b]">
                      {formatDateTimeLong(s.scheduledAt)}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-[#64748b] mt-1 italic">
                        {s.notes}
                      </p>
                    )}
                  </div>
                  {isDone ? (
                    <span className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded">
                      Bajarildi
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => complete(s.id)}
                      className="inline-flex items-center gap-1 bg-[#f59e0b] hover:bg-amber-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                    >
                      <Check size={12} /> Bajardim
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    aria-label="O‘chirish"
                    className="w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Sessiya o‘chirilsinmi?"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">
            {deleteTarget?.student?.name ?? deleteTarget?.studentId}
          </span>{' '}
          uchun rejalashtirilgan sessiya o‘chirilsin? Bu amal qaytarib
          bo‘lmaydi.
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Yo‘q
          </button>
          <button
            onClick={doDelete}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? 'O‘chirilmoqda...' : 'Ha, o‘chir'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
