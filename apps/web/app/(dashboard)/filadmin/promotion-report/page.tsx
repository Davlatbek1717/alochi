'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Megaphone, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, Modal, useToast } from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';

interface Report {
  id: string;
  schoolName: string;
  studentsReached: number;
  visitDate: string;
  notes: string | null;
  createdAt: string;
}

export default function PromotionReportPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [studentsReached, setStudentsReached] = useState(0);
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    schoolName: string;
    studentsReached: number;
    visitDate: string;
    notes: string;
  }>({ schoolName: '', studentsReached: 0, visitDate: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const toast = useToast();

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  function load() {
    setLoading(true);
    apiRequest<Report[]>('/promotion-reports/mine', {}, token())
      .then((r) => setReports(r.data ?? []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName.trim()) {
      toast.error('Maktab nomi kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/promotion-reports',
        {
          method: 'POST',
          body: JSON.stringify({
            schoolName: schoolName.trim(),
            studentsReached,
            visitDate,
            notes: notes || undefined,
          }),
        },
        token(),
      );
      setSchoolName('');
      setStudentsReached(0);
      setNotes('');
      load();
      toast.success('Hisobot saqlandi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(r: Report) {
    setEditingId(r.id);
    setEditForm({
      schoolName: r.schoolName,
      studentsReached: r.studentsReached,
      visitDate: r.visitDate.slice(0, 10),
      notes: r.notes ?? '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editForm.schoolName.trim()) {
      toast.error('Maktab nomi kerak');
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(
        `/promotion-reports/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            schoolName: editForm.schoolName.trim(),
            studentsReached: editForm.studentsReached,
            visitDate: editForm.visitDate,
            notes: editForm.notes || null,
          }),
        },
        token(),
      );
      setEditingId(null);
      load();
      toast.success('Yangilandi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest(
        `/promotion-reports/${deleteTarget.id}`,
        { method: 'DELETE' },
        token(),
      );
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("O'chirildi");
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setDeleteLoading(false);
    }
  }

  const createDisabled = saving;
  const formIncomplete = !schoolName.trim();

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6d28d9]/20 border border-[#6d28d9]/30 flex items-center justify-center">
              <Megaphone size={20} className="text-[#a78bfa]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
              <p className="text-white text-lg font-bold">Targ&apos;ibot hisoboti</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-5">
        {/* Create form */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-4">
            Yangi hisobot
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label
                htmlFor="promo-school-name"
                className="block text-xs font-semibold text-[#64748b] mb-1"
              >
                Maktab nomi
              </label>
              <input
                id="promo-school-name"
                type="text"
                placeholder="Maktab nomi"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a]"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label
                  htmlFor="promo-students"
                  className="block text-xs font-semibold text-[#64748b] mb-1"
                >
                  Talabalar soni
                </label>
                <input
                  id="promo-students"
                  type="number"
                  placeholder="Talabalar soni"
                  min={0}
                  value={studentsReached}
                  onChange={(e) => setStudentsReached(Number(e.target.value))}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              </div>
              <div className="flex-1">
                <label
                  htmlFor="promo-date"
                  className="block text-xs font-semibold text-[#64748b] mb-1"
                >
                  Sana
                </label>
                <input
                  id="promo-date"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="promo-notes"
                className="block text-xs font-semibold text-[#64748b] mb-1"
              >
                Izoh (ixtiyoriy)
              </label>
              <textarea
                id="promo-notes"
                placeholder="Izoh (ixtiyoriy)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={createDisabled}
                className="inline-flex items-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
              >
                <Plus size={14} /> {saving ? '...' : 'Saqlash'}
              </button>
              {formIncomplete && !saving && (
                <span className="text-xs text-[#94a3b8]">Maktab nomini kiriting</span>
              )}
            </div>
          </form>
        </section>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} theme="light" className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Megaphone size={28} />}
              title="Hali hisobot yo'q"
              description="Yuqoridagi forma orqali yangi hisobot qo'shing"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) =>
              editingId === r.id ? (
                <div
                  key={r.id}
                  className="bg-white border-[1.5px] border-[#6d28d9]/30 ring-1 ring-[#6d28d9]/10 rounded-2xl p-4 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#64748b] mb-1">
                      Maktab nomi
                    </label>
                    <input
                      type="text"
                      value={editForm.schoolName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, schoolName: e.target.value }))
                      }
                      className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#64748b] mb-1">
                        Talabalar soni
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editForm.studentsReached}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            studentsReached: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-[#64748b] mb-1">
                        Sana
                      </label>
                      <input
                        type="date"
                        value={editForm.visitDate}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, visitDate: e.target.value }))
                        }
                        className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#64748b] mb-1">
                      Izoh
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, notes: e.target.value }))
                      }
                      className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(r.id)}
                      disabled={editSaving}
                      className="inline-flex items-center gap-1 bg-[#15803d] hover:bg-[#166534] text-white px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-colors"
                    >
                      <Save size={12} /> Saqlash
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1 bg-[#f7f4ef] hover:bg-[#ede9e1] text-[#0f172a] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                    >
                      <X size={12} /> Bekor
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={r.id}
                  className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#0f172a] text-sm flex-1 min-w-0 truncate">
                      {r.schoolName}
                    </p>
                    <span className="text-xs text-[#64748b] shrink-0">
                      {formatDateNumeric(r.visitDate)}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">
                    {r.studentsReached} talaba
                  </p>
                  {r.notes && (
                    <p className="text-xs text-[#94a3b8] mt-1 italic">{r.notes}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => startEdit(r)}
                      className="inline-flex items-center gap-1 bg-[#f7f4ef] hover:bg-[#ede9e1] text-[#0f172a] px-2.5 py-1 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Pencil size={12} /> Tahrirlash
                    </button>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Trash2 size={12} /> O&apos;chirish
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        title="Hisobotni o'chirish"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">{deleteTarget?.schoolName}</span>{' '}
          hisobotini o&apos;chirishni tasdiqlaysizmi? Bu amalni qaytarib bo&apos;lmaydi.
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            disabled={deleteLoading}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {deleteLoading ? 'Oʻchirilmoqda...' : "Ha, o'chir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
