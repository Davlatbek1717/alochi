'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Keyword = { id: string; word: string };

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Keyword[]>('/social/keywords', {}, token)
      .then((res) => setKeywords(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Xato'))
      .finally(() => setLoading(false));
  }, []);

  async function addKeyword() {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    setSaving(true); setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Keyword>('/social/keywords', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }, token);
      setKeywords((prev) => [...prev, res.data]);
      setNewWord('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato');
    } finally { setSaving(false); }
  }

  async function deleteKeyword(id: string, word: string) {
    if (!confirm(`"${word}" so'zini o'chirish?`)) return;
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/social/keywords/${id}`, { method: 'DELETE' }, token);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xato');
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
        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
        )}

        {/* Add form */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex gap-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Yangi so'z qo'shing..."
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
              <div key={i} className="h-[50px] bg-white rounded-[14px] border border-[#ede9e1] animate-pulse" />
            ))}
          </div>
        ) : keywords.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center">
            <ShieldAlert size={36} className="text-[#94a3b8] mx-auto mb-2" />
            <p className="text-[#64748b] text-sm">Taqiqlangan so&apos;zlar yo&apos;q</p>
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
                  onClick={() => deleteKeyword(kw.id, kw.word)}
                  className="w-8 h-8 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
