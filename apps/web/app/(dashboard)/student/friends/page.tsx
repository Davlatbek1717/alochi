'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Check, X, Swords, UserX } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, Mascot, useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

type Friend = { id: string; name: string; role: string; status: string };
type PendingRequest = { id: string; name: string; role: string };

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function FriendsPage() {
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [sending, setSending] = useState(false);

  const [responding, setResponding] = useState<string | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoadError('');
    Promise.all([
      apiRequest<Friend[]>('/social/friends', {}, token),
      apiRequest<PendingRequest[]>('/social/friends/pending', {}, token),
    ])
      .then(([friendsRes, pendingRes]) => {
        setFriends(friendsRes.data ?? []);
        setPending(pendingRes.data ?? []);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Xato yuz berdi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh friend list when user returns to this tab
  useFocusRevalidate(load);
  // Refresh when duel or status events arrive (new challenge = new friend connection)
  useRevalidateOnEvent(['status:updated'], load);

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
        toast.success("Do'st qo'shildi!");
      } else {
        toast.info("So'rov rad etildi");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
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
      toast.error(err instanceof Error ? err.message : 'Duel boshlashda xato');
    } finally {
      setChallenging(null);
    }
  }

  async function handleSendRequest() {
    if (!friendId.trim()) {
      toast.warning("Foydalanuvchi ID ni kiriting");
      return;
    }
    const token = localStorage.getItem('accessToken') ?? '';
    setSending(true);
    try {
      await apiRequest('/social/friends/request', {
        method: 'POST',
        body: JSON.stringify({
          friendId: friendId.trim(),
          ...(branchId.trim() ? { branchId: branchId.trim() } : {}),
        }),
      }, token);
      toast.success("So'rov yuborildi!");
      setFriendId('');
      setBranchId('');
      setShowForm(false);
      // Refresh lists after sending request
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'So\'rov yuborilmadi');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 md:px-8 md:py-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 md:w-72 md:h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-end justify-between max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">O&apos;quvchi</p>
            <p className="text-white text-xl md:text-2xl font-bold">Do&apos;stlar</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={14} />}
            className="!bg-[#58cc02] hover:!bg-[#46a302] !border-[#46a302] !rounded-xl border-b-[3px]"
            onClick={() => setShowForm((v) => !v)}
          >
            Qo&apos;shish
          </Button>
        </div>
      </div>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-4 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {/* Load error */}
        {loadError && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-rose-200 p-6 text-center space-y-3">
            <Mascot expression="sad" size={80} className="mx-auto" />
            <p className="text-[#0f172a] font-extrabold">Yuklab bo&apos;lmadi</p>
            <p className="text-[#64748b] text-sm">{loadError}</p>
            <p className="text-[#94a3b8] text-xs">Internet aloqasini tekshiring</p>
            <Button variant="duo" size="md" onClick={load}>Qayta urinish</Button>
          </div>
        )}

        {/* Add friend form */}
        {showForm && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Yangi do&apos;st</p>
            <div>
              <label htmlFor="friend-id" className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Foydalanuvchi ID <span className="text-rose-500">*</span>
              </label>
              <input
                id="friend-id"
                type="text"
                placeholder="Foydalanuvchi ID"
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#58cc02] focus:ring-1 focus:ring-[#58cc02]"
              />
            </div>
            <div>
              <label htmlFor="branch-id" className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Filial ID <span className="text-[#94a3b8] font-normal">(ixtiyoriy)</span>
              </label>
              <input
                id="branch-id"
                type="text"
                placeholder="Filial ID"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#58cc02] focus:ring-1 focus:ring-[#58cc02]"
              />
            </div>
            <Button
              variant="duo"
              size="lg"
              fullWidth
              loading={sending}
              onClick={handleSendRequest}
            >
              {sending ? 'Yuborilmoqda...' : "So'rov yuborish"}
            </Button>
          </div>
        )}

        {/* Pending requests */}
        {loading ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <Skeleton theme="light" className="h-3 w-32 rounded" />
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5">
                <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton theme="light" className="h-3.5 w-28 rounded" />
                  <Skeleton theme="light" className="h-2.5 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                  Kutilayotgan so&apos;rovlar — {pending.length}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {pending.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#fbbf24]/20 flex items-center justify-center text-[#92400e] font-black text-sm shrink-0">
                        {getInitials(req.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0f172a] truncate">{req.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{req.role}</p>
                      </div>
                      <button
                        onClick={() => handleRespond(req.id, true)}
                        disabled={responding === req.id}
                        className="w-8 h-8 bg-[#58cc02]/15 text-[#46a302] rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-[#58cc02]/30 transition-colors"
                        aria-label="Qabul qilish"
                      >
                        {responding === req.id ? (
                          <span className="w-3 h-3 border border-[#46a302]/40 border-t-[#46a302] rounded-full animate-spin" />
                        ) : (
                          <Check size={15} />
                        )}
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, false)}
                        disabled={responding === req.id}
                        className="w-8 h-8 bg-[#ff4b4b]/10 text-[#ff4b4b] rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-[#ff4b4b]/20 transition-colors"
                        aria-label="Rad etish"
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
                <EmptyState
                  theme="light"
                  icon={<UserX size={24} />}
                  title="Hali do'stlar yo'q"
                  description="Do'st qo'shish uchun yuqoridagi tugmani bosing"
                  className="py-6"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {friends.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 bg-[#f7f4ef] rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#0f172a]/10 flex items-center justify-center text-[#0f172a] font-black text-sm shrink-0">
                        {getInitials(f.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0f172a] truncate">{f.name}</p>
                        <p className="text-[10px] text-[#94a3b8]">{f.role}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={challenging === f.id}
                        disabled={!!challenging}
                        icon={<Swords size={12} />}
                        className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl !text-xs"
                        onClick={() => handleChallenge(f.id)}
                      >
                        Duel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Big add button if no friends and form not shown */}
            {friends.length === 0 && pending.length === 0 && !showForm && (
              <Button
                variant="duo"
                size="lg"
                fullWidth
                icon={<Users size={16} />}
                onClick={() => setShowForm(true)}
              >
                Do&apos;st qo&apos;shish
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
