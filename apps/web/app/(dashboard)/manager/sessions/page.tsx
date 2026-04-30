'use client';
import { useEffect, useState } from 'react';
import { Calendar, Plus, Check } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, useToast } from '@/components/ui';

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
}

export default function ManagerSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
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

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Calendar className="text-violet-500" size={20} />
        <h1 className="text-lg font-bold text-gray-800">1:1 sessiyalar</h1>
      </div>

      <form
        onSubmit={create}
        className="bg-white border border-gray-100 rounded-xl p-4 space-y-3"
      >
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
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
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
        />
        <textarea
          placeholder="Izoh (ixtiyoriy)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        >
          <Plus size={14} /> {saving ? '...' : 'Rejalashtirish'}
        </button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} theme="light" className="h-16 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          Hali sessiya yo&apos;q
        </p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isDone = Boolean(s.completedAt);
            return (
              <div
                key={s.id}
                className={`border rounded-xl p-3 flex items-center justify-between gap-3 ${
                  isDone
                    ? 'bg-emerald-50/40 border-emerald-100'
                    : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">
                    {s.student?.name ?? s.studentId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(s.scheduledAt).toLocaleString('uz-UZ')}
                  </p>
                  {s.notes && (
                    <p className="text-xs text-gray-600 mt-1 italic">
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
                    className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                  >
                    <Check size={12} /> Bajardim
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
