'use client';
import { useEffect, useState } from 'react';
import { Gift, Pencil, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

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
  const toast = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Create
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState('gift');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit
  const [editing, setEditing] = useState<Reward | null>(null);
  const [editForm, setEditForm] = useState({
    type: 'gift',
    title: '',
    description: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);
  const [deleting, setDeleting] = useState(false);

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  async function load() {
    setLoading(true);
    try {
      const r = await apiRequest<Reward[]>('/manager-rewards', {}, token());
      setRewards(r.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let branchId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        branchId?: string;
      };
      branchId = u.branchId ?? '';
    } catch {
      /* ignore */
    }
    if (branchId) {
      apiRequest<Student[]>(
        `/users/by-branch/${branchId}?role=student`,
        {},
        token(),
      )
        .then((r) =>
          setStudents(
            r.data.filter(
              (s: Student & { role?: string }) =>
                (s as { role?: string }).role === 'student' || true,
            ),
          ),
        )
        .catch(() => setStudents([]));
    }
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !title) return;
    setSubmitting(true);
    try {
      await apiRequest(
        '/manager-rewards',
        {
          method: 'POST',
          body: JSON.stringify({ studentId, type, title, description }),
        },
        token(),
      );
      toast.success('Saqlandi');
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(r: Reward) {
    setEditing(r);
    setEditForm({
      type: r.type,
      title: r.title,
      description: r.description ?? '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.title.trim()) {
      toast.error('Nomi kerak');
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(
        `/manager-rewards/${editing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            type: editForm.type,
            title: editForm.title.trim(),
            description: editForm.description || null,
          }),
        },
        token(),
      );
      toast.success('Saqlandi');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setEditSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(
        `/manager-rewards/${deleteTarget.id}`,
        { method: 'DELETE' },
        token(),
      );
      toast.success('O‘chirildi');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Gift size={20} className="text-amber-500" />
        <h1 className="text-xl font-bold text-[#0f172a]">Sovgʻa va Kitob</h1>
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3"
      >
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          required
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        >
          <option value="">O&apos;quvchi tanlang</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        >
          <option value="gift">Sovgʻa</option>
          <option value="book">Kitob</option>
          <option value="other">Boshqa</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Nomi"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Izoh (ixtiyoriy)"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        />
        <button
          disabled={submitting}
          className="w-full bg-[#0f172a] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
        >
          {submitting ? 'Yuborilmoqda...' : 'Berish'}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
          Tarix
        </p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[18px]" theme="light" />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Gift size={28} />}
              title="Hech narsa yoʻq"
              description="Birinchi sovgʻani bering"
              theme="light"
            />
          </div>
        ) : (
          rewards.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0f172a]">
                  {r.title}
                </p>
                <p className="text-xs text-[#64748b]">
                  {r.type} •{' '}
                  {new Date(r.givenAt).toLocaleDateString('uz-UZ')}
                </p>
                {r.description && (
                  <p className="text-xs text-[#64748b] mt-1">
                    {r.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => startEdit(r)}
                aria-label="Tahrirlash"
                className="w-8 h-8 bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setDeleteTarget(r)}
                aria-label="O‘chirish"
                className="w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Edit */}
      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Sovgʻani tahrirlash"
        theme="light"
      >
        <div className="space-y-3">
          <select
            value={editForm.type}
            onChange={(e) =>
              setEditForm({ ...editForm, type: e.target.value })
            }
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
          >
            <option value="gift">Sovgʻa</option>
            <option value="book">Kitob</option>
            <option value="other">Boshqa</option>
          </select>
          <input
            value={editForm.title}
            onChange={(e) =>
              setEditForm({ ...editForm, title: e.target.value })
            }
            placeholder="Nomi *"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
          />
          <textarea
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
            rows={2}
            placeholder="Izoh"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
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

      {/* Delete */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Sovgʻa o‘chirilsinmi?"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">
            {deleteTarget?.title}
          </span>{' '}
          o‘chirilsin? Bu amal qaytarib bo‘lmaydi.
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
