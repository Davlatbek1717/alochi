'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Check, X, Swords, UserX, Search, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton, EmptyState, Mascot, useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

type Friend = { id: string; name: string; role: string; status: string };
type PendingRequest = { id: string; name: string; role: string };
type Candidate = { id: string; name: string; login: string; role: string };

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function FriendsPage() {
  const toast = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced typeahead: 300ms after the user stops typing, fetch matching
  // users. Less than 2 chars clears the list immediately.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const token = localStorage.getItem('accessToken') ?? '';
      try {
        const res = await apiRequest<Candidate[]>(
          `/social/friends/search?q=${encodeURIComponent(q)}`,
          {},
          token,
        );
        setCandidates(res.data ?? []);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  async function handleSendRequestTo(candidate: Candidate) {
    const token = localStorage.getItem('accessToken') ?? '';
    setSendingTo(candidate.id);
    try {
      await apiRequest('/social/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendLogin: candidate.login }),
      }, token);
      toast.success(`${candidate.name} ga so'rov yuborildi!`);
      setSearchQuery('');
      setCandidates([]);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "So'rov yuborilmadi");
    } finally {
      setSendingTo(null);
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
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Yangi do&apos;st qidirish</p>
            <div>
              <label htmlFor="friend-search" className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Login yoki ism
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                <input
                  id="friend-search"
                  type="text"
                  placeholder="masalan: odilov"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl pl-10 pr-10 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#58cc02] focus:ring-1 focus:ring-[#58cc02]"
                />
                {searching && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] animate-spin" />
                )}
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-1.5">Kamida 2 ta belgi yozing</p>
            </div>

            {/* Search results */}
            {searchQuery.trim().length >= 2 && !searching && candidates.length === 0 && (
              <p className="text-sm text-[#64748b] text-center py-4">
                Hech kim topilmadi
              </p>
            )}
            {candidates.length > 0 && (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSendRequestTo(c)}
                    disabled={sendingTo !== null}
                    className="w-full flex items-center gap-3 bg-[#f7f4ef] hover:bg-[#ede9e1] disabled:opacity-50 rounded-xl px-3 py-2.5 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#58cc02]/15 flex items-center justify-center text-[#46a302] font-black text-sm shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0f172a] truncate">{c.name}</p>
                      <p className="text-[11px] text-[#94a3b8] truncate">@{c.login} · {c.role}</p>
                    </div>
                    {sendingTo === c.id ? (
                      <Loader2 size={16} className="text-[#46a302] animate-spin shrink-0" />
                    ) : (
                      <UserPlus size={16} className="text-[#46a302] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
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
