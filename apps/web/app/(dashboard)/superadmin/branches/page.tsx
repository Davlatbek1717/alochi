'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
}

export default function SuperadminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  async function load() {
    setLoading(true);
    try {
      const res = await apiRequest<Branch[]>('/branches', {}, token());
      setBranches(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createBranch() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await apiRequest('/branches', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim() }),
      }, token());
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setCreating(false);
    }
  }

  async function saveName(id: string) {
    if (!editName.trim()) return;
    setError('');
    try {
      await apiRequest(`/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      }, token());
      setEditId(null);
      setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, name: editName.trim() } : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-bold">Filiallar</h1>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createBranch()}
          placeholder="Yangi filial nomi..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={createBranch}
          disabled={creating || !newName.trim()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {creating ? '...' : 'Qo\'shish'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : branches.length === 0 ? (
        <p className="text-gray-400 text-sm">Filiallar yo&apos;q</p>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <div key={b.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3">
              {editId === b.id ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveName(b.id)}
                    className="flex-1 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button onClick={() => saveName(b.id)} className="text-sm text-indigo-600 font-medium">Saqlash</button>
                  <button onClick={() => setEditId(null)} className="text-sm text-gray-400">Bekor</button>
                </>
              ) : (
                <>
                  <p className="flex-1 font-medium text-gray-800">{b.name}</p>
                  <button
                    onClick={() => { setEditId(b.id); setEditName(b.name); }}
                    className="text-sm text-gray-400 hover:text-indigo-600"
                  >
                    Tahrirlash
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
