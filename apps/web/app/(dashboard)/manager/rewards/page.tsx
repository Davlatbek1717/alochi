'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gift, Pencil, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';
import { getBranchIdFromToken } from '@/lib/jwt';

type Reward = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  studentId: string;
  givenAt: string;
};

type Student = { id: string; name: string };

const TYPE_LABEL: Record<string, string> = { gift: "Sovg'a", book: 'Kitob', other: 'Boshqa' };

export default function ManagerRewardsPage() {
  const router = useRouter();
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sovg'alar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  const [hasBranch, setHasBranch] = useState(true);

  useEffect(() => {
    const branchId = getBranchIdFromToken() ?? '';
    setHasBranch(!!branchId);
    if (branchId) {
      apiRequest<Student[]>(
        `/users/by-branch/${branchId}?role=student`,
        {},
        token(),
      )
        .then((r) => setStudents(r.data))
        .catch(() => setStudents([]));
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId || !title.trim()) return;
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
      toast.success("O'chirildi");
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/manager')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Manager
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 flex items-center justify-center">
              <Gift size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Mukofotlar</p>
              <p className="text-[#94a3b8] text-xs">O&apos;quvchilarga sovg&apos;a/kitob berish</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {!hasBranch && !loading ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-rose-800">Filial biriktirilmagan</p>
            <p className="mt-1 text-sm text-rose-700">
              Hisobingiz biror filialga biriktirilmagan. Superadmin orqali filial tayinlanishini so&apos;rang.
            </p>
          </div>
        ) : null}

      <form
        onSubmit={submit}
        className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3"
      >
        <div>
          <label htmlFor="reward-student" className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">O&apos;quvchi</label>
          <select
            id="reward-student"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          >
            <option value="">O&apos;quvchi tanlang</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reward-type" className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Tur</label>
          <select
            id="reward-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          >
            <option value="gift">Sovgʻa</option>
            <option value="book">Kitob</option>
            <option value="other">Boshqa</option>
          </select>
        </div>
        <div>
          <label htmlFor="reward-title" className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Sarlavha</label>
          <input
            id="reward-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Nomi"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          />
        </div>
        <div>
          <label htmlFor="reward-description" className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">Tafsilot</label>
          <textarea
            id="reward-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Izoh (ixtiyoriy)"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          />
        </div>
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
                  {TYPE_LABEL[r.type] ?? r.type} •{' '}
                  {formatDateNumeric(r.givenAt)}
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
                aria-label="O'chirish"
                className="w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
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
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
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
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          />
          <textarea
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
            rows={2}
            placeholder="Izoh"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
          />
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setEditing(null)}
              disabled={editSaving}
              className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#0f172a] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
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
        title="Sovgʻa o'chirilsinmi?"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">
            {deleteTarget?.title}
          </span>{' '}
          o&apos;chirilsin? Bu amal qaytarib bo&apos;lmaydi.
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#0f172a] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
          >
            Yo&apos;q
          </button>
          <button
            onClick={doDelete}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "O'chirilmoqda..." : "Ha, o'chir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
