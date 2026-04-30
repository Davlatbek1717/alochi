'use client';
import { useEffect, useState } from 'react';
import { Building2, Plus, Check, X, Pencil } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/ui';

interface Branch { id: string; name: string; }

export default function SuperadminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
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
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiRequest('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
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

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
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
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createBranch()}
            placeholder="Yangi filial nomi..."
            className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
          />
          <button
            onClick={createBranch}
            disabled={creating || !newName.trim()}
            className="bg-[#0f172a] text-white px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-1.5"
          >
            {creating
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus size={16} />}
            Qo&apos;sh
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[58px] rounded-[14px]" />
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Building2 size={28} />}
              title="Filiallar yo'q"
              description="Birinchi filialni yarating"
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
                      onKeyDown={(e) => e.key === 'Enter' && saveName(b.id)}
                      className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                    />
                    <button
                      onClick={() => saveName(b.id)}
                      className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="w-8 h-8 bg-[#f7f4ef] text-[#94a3b8] rounded-xl flex items-center justify-center"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 font-semibold text-[#0f172a] text-sm">{b.name}</p>
                    <button
                      onClick={() => { setEditId(b.id); setEditName(b.name); }}
                      className="w-8 h-8 bg-[#f7f4ef] text-[#64748b] hover:text-[#0f172a] rounded-xl flex items-center justify-center"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
