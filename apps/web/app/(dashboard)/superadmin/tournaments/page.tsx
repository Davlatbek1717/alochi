'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Plus,
  X,
  Calendar,
  Users,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  Skeleton,
  useToast,
} from '@/components/ui';
import { formatDateShort } from '@/lib/date-uz';

type Tournament = {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  status?: string;
  _count?: { registrations: number };
};

function emptyForm() {
  return {
    title: '',
    type: 'individual',
    startsAt: '',
    endsAt: '',
  };
}

export default function SuperadminTournamentsPage() {
  const toast = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  // Edit
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [editForm, setEditForm] = useState(emptyForm());
  const [editSaving, setEditSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState(false);

  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') ?? ''
      : '';

  function load() {
    setLoading(true);
    apiRequest<Tournament[]>('/tournaments', {}, token)
      .then((res) => setTournaments(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<Tournament>(
        '/tournaments',
        {
          method: 'POST',
          body: JSON.stringify(form),
        },
        token,
      );
      setTournaments((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm(emptyForm());
      toast.success('Turnir yaratildi');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Turnir yaratishda xatolik',
      );
    }
    setSubmitting(false);
  }

  function startEdit(t: Tournament) {
    setEditing(t);
    setEditForm({
      title: t.title,
      type: t.type,
      startsAt: t.startsAt.slice(0, 16),
      endsAt: t.endsAt.slice(0, 16),
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
      const res = await apiRequest<Tournament>(
        `/tournaments/${editing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: editForm.title,
            type: editForm.type,
            startsAt: editForm.startsAt
              ? new Date(editForm.startsAt).toISOString()
              : undefined,
            endsAt: editForm.endsAt
              ? new Date(editForm.endsAt).toISOString()
              : undefined,
          }),
        },
        token,
      );
      setTournaments((prev) =>
        prev.map((t) =>
          t.id === editing.id ? { ...t, ...res.data } : t,
        ),
      );
      toast.success('Saqlandi');
      setEditing(null);
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
        `/tournaments/${deleteTarget.id}`,
        { method: 'DELETE' },
        token,
      );
      setTournaments((prev) =>
        prev.filter((t) => t.id !== deleteTarget.id),
      );
      toast.success('Turnir o‘chirildi');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setDeleting(false);
    }
  }

  const formatDate = (iso: string) =>
    formatDateShort(iso);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
              <Trophy size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                Superadmin
              </p>
              <p className="text-white text-lg font-bold">Turnirlar</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={showForm ? <X size={16} /> : <Plus size={16} />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Yopish' : 'Yangi'}
          </Button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Yangi turnir yaratish</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Turnir nomi"
                aria-label="Turnir nomi"
                className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
              />
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                aria-label="Turnir turi"
                className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b] bg-white"
              >
                <option value="individual">Individual</option>
                <option value="team">Jamoaviy</option>
                <option value="group">Guruh</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="t-starts-at"
                    className="text-xs text-[#64748b] mb-1 block"
                  >
                    Boshlanish
                  </label>
                  <input
                    id="t-starts-at"
                    required
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startsAt: e.target.value }))
                    }
                    className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="t-ends-at"
                    className="text-xs text-[#64748b] mb-1 block"
                  >
                    Tugash
                  </label>
                  <input
                    id="t-ends-at"
                    required
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endsAt: e.target.value }))
                    }
                    className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => setShowForm(false)}
                >
                  Bekor qilish
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={submitting}
                >
                  {submitting ? 'Saqlanmoqda...' : 'Saqlash'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1] space-y-2"
              >
                <Skeleton theme="light" className="h-4 w-2/3" />
                <Skeleton theme="light" className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Trophy size={28} />}
              title="Hali turnirlar yo'q"
              description="Birinchi turnirni yarating"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-[18px] px-4 py-3.5 border-[1.5px] border-[#ede9e1] flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
                  <Trophy size={18} className="text-[#f59e0b]" />
                </div>
                <Link
                  href={`/superadmin/tournaments/${t.id}/bracket`}
                  className="flex-1 min-w-0 group"
                >
                  <p className="text-[#0f172a] font-bold text-sm truncate group-hover:underline">
                    {t.title}
                  </p>
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
                </Link>
                <button
                  onClick={() => startEdit(t)}
                  aria-label="Tahrirlash"
                  className="w-8 h-8 bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(t)}
                  aria-label="O‘chirish"
                  className="w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                <Link
                  href={`/superadmin/tournaments/${t.id}/bracket`}
                  aria-label={`${t.title} bracket`}
                  className="w-8 h-8 bg-[#f7f4ef] text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => !editSaving && setEditing(null)}
        title="Turnirni tahrirlash"
        theme="light"
      >
        <div className="space-y-3">
          <input
            value={editForm.title}
            onChange={(e) =>
              setEditForm({ ...editForm, title: e.target.value })
            }
            placeholder="Turnir nomi"
            className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
          />
          <select
            value={editForm.type}
            onChange={(e) =>
              setEditForm({ ...editForm, type: e.target.value })
            }
            className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b] bg-white"
          >
            <option value="individual">Individual</option>
            <option value="team">Jamoaviy</option>
            <option value="group">Guruh</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="et-starts"
                className="text-xs text-[#64748b] mb-1 block"
              >
                Boshlanish
              </label>
              <input
                id="et-starts"
                type="datetime-local"
                value={editForm.startsAt}
                onChange={(e) =>
                  setEditForm({ ...editForm, startsAt: e.target.value })
                }
                className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
              />
            </div>
            <div>
              <label
                htmlFor="et-ends"
                className="text-xs text-[#64748b] mb-1 block"
              >
                Tugash
              </label>
              <input
                id="et-ends"
                type="datetime-local"
                value={editForm.endsAt}
                onChange={(e) =>
                  setEditForm({ ...editForm, endsAt: e.target.value })
                }
                className="w-full border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#f59e0b]"
              />
            </div>
          </div>
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

      {/* Delete confirm */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Turnir o‘chirilsinmi?"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">
            {deleteTarget?.title}
          </span>{' '}
          o‘chirilsin? Barcha qatnashuvchilar ham o‘chiriladi.
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
