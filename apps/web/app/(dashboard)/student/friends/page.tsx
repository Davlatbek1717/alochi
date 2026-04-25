'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type Friend = {
  id: string;
  name: string;
  role: string;
  status: string;
};

type PendingRequest = {
  id: string;
  name: string;
  role: string;
};

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const [responding, setResponding] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [friendsRes, pendingRes] = await Promise.all([
          apiRequest<Friend[]>('/social/friends', {}, token),
          apiRequest<PendingRequest[]>('/social/friends/pending', {}, token),
        ]);
        setFriends(friendsRes.data);
        setPending(pendingRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleRespond(id: string, accept: boolean) {
    const token = localStorage.getItem('accessToken') ?? '';
    setResponding(id);
    try {
      await apiRequest(`/social/friends/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept }),
      }, token);
      setPending((prev) => prev.filter((r) => r.id !== id));
      if (accept) {
        const accepted = pending.find((r) => r.id === id);
        if (accepted) {
          setFriends((prev) => [...prev, { ...accepted, status: 'accepted' }]);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setResponding(null);
    }
  }

  async function handleChallenge(friendId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<{ id: string }>('/social/duels', {
        method: 'POST',
        body: JSON.stringify({ challengedId: friendId }),
      }, token);
      router.push(`/student/duel/${res.data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  async function handleSendRequest() {
    if (!friendId.trim() || !branchId.trim()) {
      setSendMsg("Iltimos, barcha maydonlarni to'ldiring");
      return;
    }
    const token = localStorage.getItem('accessToken') ?? '';
    setSending(true);
    setSendMsg('');
    try {
      await apiRequest('/social/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendId: friendId.trim(), branchId: branchId.trim() }),
      }, token);
      setSendMsg("So'rov yuborildi!");
      setFriendId('');
      setBranchId('');
      setShowForm(false);
    } catch (err) {
      setSendMsg(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-20 flex justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Do&apos;stlar</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
        >
          + Do&apos;st qo&apos;shish
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border border-gray-100">
          <p className="font-medium text-sm text-gray-700">Yangi do&apos;st qo&apos;shish</p>
          <input
            type="text"
            placeholder="Foydalanuvchi ID"
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <input
            type="text"
            placeholder="Filial ID"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={handleSendRequest}
            disabled={sending}
            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {sending ? 'Yuborilmoqda...' : "So'rov yuborish"}
          </button>
          {sendMsg && (
            <p className={`text-sm ${sendMsg.includes('yuborildi') ? 'text-green-600' : 'text-red-500'}`}>
              {sendMsg}
            </p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 border border-gray-100">
          <h2 className="font-semibold text-gray-700">Kutilayotgan so&apos;rovlar ({pending.length})</h2>
          {pending.map((req) => (
            <div key={req.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="font-medium text-sm">{req.name}</p>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  {req.role}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(req.id, true)}
                  disabled={responding === req.id}
                  className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Qabul
                </button>
                <button
                  onClick={() => handleRespond(req.id, false)}
                  disabled={responding === req.id}
                  className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Rad etish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-700 mb-3">Do&apos;stlarim ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Hali do&apos;stlar yo&apos;q</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{f.name}</p>
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {f.role}
                </span>
              <button
                onClick={() => handleChallenge(f.id)}
                className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-medium"
              >
                ⚡ Duel
              </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
