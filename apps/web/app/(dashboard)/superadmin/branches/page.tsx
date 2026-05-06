'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, Check, X, Pencil, Trash2, ChevronRight, Users } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  EmptyState,
  Skeleton,
  useToast,
  Modal,
} from '@/components/ui';

interface Branch {
  id: string;
  name: string;
  userCount?: number;
}

export default function SuperadminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const token = () => localStorage.getItem('accessToken') ?? '';

  async function load() {
    setLoading(true);
    try {
      const res = await apiRequest<Branch[]>('/branches', {}, token());
      setBranches(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createBranch() {
    const name = newName.trim();
    if (!name) {
      toast.error('Filial nomi kiritilishi shart');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/branches', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }, token());
      setNewName('');
      await load();
      toast.success('Filial yaratildi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally { setCreating(false); }
  }

  async function saveName(id: string) {
    if (!editName.trim()) return;
    try {
      await apiRequest(`/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      }, token());
      setEditId(null);
      setBranches((prev) => prev.map((b) => b.id === id ? { ...b, name: editName.trim() } : b));
      toast.success('Filial nomi yangilandi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/branches/${deleteTarget.id}`, {
        method: 'DELETE',
      }, token());
      setBranches((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      toast.success('Filial o’chirildi');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally { setDeleting(false); }
  }

  const inputEmpty = !newName.trim();

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <Building2 size={18} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white font-bold text-lg">Filiallar</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Add form */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createBranch()}
              placeholder="Yangi filial nomi..."
              aria-label="Yangi filial nomi"
              className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
            />
            <button
              onClick={createBranch}
              disabled={creating}
              aria-label="Filial qo'shish"
              className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors ${
                creating
                  ? 'bg-[#0f172a] text-white opacity-70 cursor-wait'
                  : inputEmpty
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-[#0f172a] text-white hover:bg-[#1e293b]'
              }`}
            >
              {creating
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Plus size={16} />}
              Qo&apos;sh
            </button>
          </div>
          {inputEmpty && (
            <p className="text-xs text-[#94a3b8] pl-1">Filial nomini kiritib, Enter bosing yoki tugmani bosing</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[58px] rounded-[14px]" theme="light" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Building2 size={28} />}
              title="Filiallar yo'q"
              description="Birinchi filialni yarating"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {branches.map((b) => (
              <div key={b.id} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] px-4 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f7f4ef] flex items-center justify-center shrink-0">
                  <Building2 size={15} className="text-[#64748b]" />
                </div>
                {editId === b.id ? (
                  <>
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(b.id);
                        if (e.key === 'Escape') setEditId(null);
                      }}
                      aria-label="Filial nomini tahrirlash"
                      className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                    />
                    <button
                      onClick={() => saveName(b.id)}
                      aria-label="Saqlash"
                      className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center hover:bg-emerald-200"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      aria-label="Bekor qilish"
                      className="w-8 h-8 bg-[#f7f4ef] text-[#94a3b8] rounded-xl flex items-center justify-center hover:bg-[#ede9e1]"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/superadmin/branches/${b.id}`}
                      className="flex-1 min-w-0 group"
                    >
                      <p className="font-semibold text-[#0f172a] text-sm truncate group-hover:underline">{b.name}</p>
                      <p className="text-xs text-[#94a3b8] flex items-center gap-1">
                        <Users size={10} />
                        {b.userCount ?? 0} foydalanuvchi
                      </p>
                    </Link>
                    <button
                      onClick={() => { setEditId(b.id); setEditName(b.name); }}
                      aria-label={`${b.name} nomini tahrirlash`}
                      className="w-8 h-8 bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(b)}
                      aria-label={`${b.name} filialini o'chirish`}
                      className="w-8 h-8 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <Link
                      href={`/superadmin/branches/${b.id}`}
                      aria-label={`${b.name} batafsil`}
                      className="w-8 h-8 bg-[#f7f4ef] text-[#94a3b8] hover:text-[#0f172a] hover:bg-[#ede9e1] rounded-xl flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={14} />
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Filialni o'chirish"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              O&apos;chirish
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{deleteTarget?.name}</span> filialini o&apos;chirmoqchimisiz?
        </p>
        {deleteTarget && (deleteTarget.userCount ?? 0) > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Bu filialda <strong>{deleteTarget.userCount}</strong> foydalanuvchi bor. O&apos;chirish uchun ularni avval boshqa filialga ko&apos;chiring.
          </p>
        )}
      </Modal>
    </div>
  );
}
