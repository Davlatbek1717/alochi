'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Keyword = {
  id: string;
  word: string;
};

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
    setSaving(true);
    setError('');
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
    } finally {
      setSaving(false);
    }
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') addKeyword();
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Taqiqlangan so&apos;zlar</h1>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Yangi so'z qo'shing..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={addKeyword}
          disabled={saving || !newWord.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 shrink-0"
        >
          {saving ? '...' : "Qo'sh"}
        </button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Yuklanmoqda...</p>
      ) : keywords.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Taqiqlangan so&apos;zlar yo&apos;q</p>
      ) : (
        <div className="space-y-2">
          {keywords.map((kw) => (
            <div
              key={kw.id}
              className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm"
            >
              <span className="text-sm text-gray-800 font-mono">{kw.word}</span>
              <button
                onClick={() => deleteKeyword(kw.id, kw.word)}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                O&apos;chir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
