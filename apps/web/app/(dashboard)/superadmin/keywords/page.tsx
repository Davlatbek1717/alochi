'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button,
  EmptyState,
  Skeleton,
  Modal,
  useToast,
} from '@/components/ui';

type Keyword = { id: string; word: string };

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Keyword | null>(null);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Keyword[]>('/social/keywords', {}, token)
      .then((res) => setKeywords(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Xato'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addKeyword() {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Keyword>('/social/keywords', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }, token);
      setKeywords((prev) => [...prev, res.data]);
      setNewWord('');
      toast.success(`"${word}" so'zi qo'shildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { id, word } = deleteTarget;
    setDeleteTarget(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/keywords/${id}`, { method: 'DELETE' }, token);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      toast.success(`"${word}" o'chirildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e11d48 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e11d48]/20 flex items-center justify-center">
              <ShieldAlert size={18} className="text-[#e11d48]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white font-bold text-lg">Taqiqlangan so&apos;zlar</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Add form */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex gap-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Yangi so'z qo'shing..."
            aria-label="Taqiqlangan so'z kiriting"
            className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
          />
          <button
            onClick={addKeyword}
            disabled={saving || !newWord.trim()}
            className="bg-[#0f172a] text-white px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus size={16} />}
            Qo&apos;sh
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[50px] rounded-[14px]" theme="light" />
            ))}
          </div>
        ) : keywords.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<ShieldAlert size={28} />}
              title="Taqiqlangan so'zlar yo'q"
              description="Hali birorta so'z qo'shilmagan"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {keywords.map((kw) => (
              <div
                key={kw.id}
                className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] px-4 py-3.5 flex items-center gap-3"
              >
                <span className="flex-1 text-sm text-[#0f172a] font-mono font-medium">{kw.word}</span>
                <button
                  onClick={() => setDeleteTarget(kw)}
                  className="w-8 h-8 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="So'zni o'chirish"
        description={deleteTarget ? `"${deleteTarget.word}" so'zini taqiqlangan ro'yxatdan o'chirish?` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Bekor</Button>
            <Button variant="danger" onClick={confirmDelete}>O&apos;chirish</Button>
          </>
        }
      >
        <p className="text-slate-400 text-sm">Bu amalni bekor qilib bo&apos;lmaydi.</p>
      </Modal>
    </div>
  );
}
