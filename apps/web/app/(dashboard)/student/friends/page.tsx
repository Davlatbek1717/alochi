'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Check, X, Swords, UserX } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Friend = { id: string; name: string; role: string; status: string };
type PendingRequest = { id: string; name: string; role: string };

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

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
  const [challenging, setChallenging] = useState<string | null>(null);
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
        if (accepted) setFriends((prev) => [...prev, { ...accepted, status: 'accepted' }]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setResponding(null);
    }
  }

  async function handleChallenge(fId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setChallenging(fId);
    try {
      const res = await apiRequest<{ id: string }>('/social/duels', {
        method: 'POST',
        body: JSON.stringify({ challengedId: fId }),
      }, token);
      router.push(`/student/duel/${res.data.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setChallenging(null);
    }
  }

  async function handleSendRequest() {
    if (!friendId.trim() || !branchId.trim()) { setSendMsg("Barcha maydonlarni to'ldiring"); return; }
    const token = localStorage.getItem('accessToken') ?? '';
    setSending(true); setSendMsg('');
    try {
      await apiRequest('/social/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendId: friendId.trim(), branchId: branchId.trim() }),
      }, token);
      setSendMsg("So'rov yuborildi!");
      setFriendId(''); setBranchId('');
      setShowForm(false);
    } catch (err) {
      setSendMsg(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-end justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">O&apos;quvchi</p>
            <p className="text-white text-xl font-bold">Do&apos;stlar</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-[#0d9488] text-white px-4 py-2.5 rounded-xl text-sm font-bold"
          >
            <UserPlus size={16} /> Qo&apos;shish
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
        )}

        {/* Add friend form */}
        {showForm && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Yangi do&apos;st</p>
            <input
              type="text"
              placeholder="Foydalanuvchi ID"
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
            />
            <input
              type="text"
              placeholder="Filial ID"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
            />
            {sendMsg && (
              <p className={`text-sm ${sendMsg.includes('yuborildi') ? 'text-emerald-600' : 'text-rose-500'}`}>{sendMsg}</p>
            )}
            <button
              onClick={handleSendRequest}
              disabled={sending}
              className="w-full bg-[#0f172a] text-white py-3.5 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {sending ? 'Yuborilmoqda...' : "So'rov yuborish"}
            </button>
          </div>
        )}

        {/* Pending requests */}
        {pending.length > 0 && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              Kutilayotgan so&apos;rovlar — {pending.length}
            </p>
            <div className="space-y-2">
              {pending.map((req) => (
                <div key={req.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-black text-sm shrink-0">
                    {getInitials(req.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0f172a] truncate">{req.name}</p>
                    <p className="text-[10px] text-[#94a3b8]">{req.role}</p>
                  </div>
                  <button
                    onClick={() => handleRespond(req.id, true)}
                    disabled={responding === req.id}
                    className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center disabled:opacity-50"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, false)}
                    disabled={responding === req.id}
                    className="w-8 h-8 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center disabled:opacity-50"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
            Do&apos;stlarim — {friends.length}
          </p>
          {friends.length === 0 ? (
            <div className="py-8 text-center">
              <UserX size={32} className="text-[#94a3b8] mx-auto mb-2" />
              <p className="text-sm text-[#94a3b8]">Hali do&apos;stlar yo&apos;q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#0f172a]/10 flex items-center justify-center text-[#0f172a] font-black text-sm shrink-0">
                    {getInitials(f.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0f172a] truncate">{f.name}</p>
                    <p className="text-[10px] text-[#94a3b8]">{f.role}</p>
                  </div>
                  <button
                    onClick={() => handleChallenge(f.id)}
                    disabled={challenging === f.id}
                    className="flex items-center gap-1.5 bg-[#0f172a] text-white text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50"
                  >
                    {challenging === f.id
                      ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      : <Swords size={12} />}
                    Duel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Big add button if no friends and form not shown */}
        {friends.length === 0 && pending.length === 0 && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm"
          >
            <Users size={16} /> Do&apos;st qo&apos;shish
          </button>
        )}
      </div>
    </div>
  );
}
