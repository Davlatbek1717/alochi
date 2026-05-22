'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Loader2, Swords, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { Ustoz } from '@/components/Ustoz';

type Friend = { id: string; name: string; role: string; status: string };
type PendingRequest = { id: string; name: string; role: string };
type Candidate = { id: string; name: string; login: string; role: string };

function getInitials(name: string | null | undefined) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function FriendsPage() {
  const toast = useToast();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [responding, setResponding] = useState<string | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);

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

  useFocusRevalidate(load);
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

  // Debounced typeahead — 300ms after the user stops typing.
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
    <div className="sp-theme min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-lg mx-auto md:max-w-3xl">
        <Link
          href="/student"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="sp-eyebrow">aloqalar</div>
          <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
            Do‘stlar
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-label="Do‘st qo‘shish"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:translate-y-[2px] transition-transform"
          style={{
            background: 'var(--leaf)',
            color: 'var(--bone)',
            border: '1.5px solid var(--leaf-deep)',
            boxShadow: '0 3px 0 var(--leaf-deep)',
          }}
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="px-4 max-w-lg mx-auto md:max-w-3xl space-y-3">
        {/* Add-friend search */}
        {showForm && (
          <div
            className="p-4 space-y-3"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <div className="sp-eyebrow">Yangi do‘st qidirish</div>
            <div
              className="flex items-center gap-2 px-3.5"
              style={{
                background: 'var(--bone-2)',
                border: '1.5px solid var(--line)',
                borderRadius: 'var(--r-3)',
              }}
            >
              <Search size={16} style={{ color: 'var(--ink-3)' }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="login yoki ism bo‘yicha qidir…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                className="flex-1 py-3 bg-transparent outline-none text-sm"
                style={{ color: 'var(--ink)', fontFamily: 'var(--f-ui)' }}
              />
              {searching && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ink-3)' }} />}
            </div>
            {searchQuery.trim().length >= 2 && !searching && candidates.length === 0 && (
              <p className="text-sm text-center py-3" style={{ color: 'var(--ink-3)' }}>
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left disabled:opacity-50"
                    style={{ background: 'var(--bone-2)', borderRadius: 'var(--r-2)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center sp-display shrink-0"
                      style={{ background: 'var(--leaf-tint)', color: 'var(--leaf-deep)', fontWeight: 800 }}
                    >
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="sp-display text-sm truncate" style={{ color: 'var(--ink)' }}>
                        {c.name}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                        @{c.login} · {c.role}
                      </p>
                    </div>
                    {sendingTo === c.id ? (
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--leaf-deep)' }} />
                    ) : (
                      <Plus size={16} style={{ color: 'var(--leaf-deep)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1"
          style={{ background: 'var(--paper-2)', borderRadius: 999 }}
        >
          {([
            { k: 'friends', l: `Do‘stlar (${friends.length})` },
            { k: 'requests', l: `So‘rovlar (${pending.length})` },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className="flex-1 py-2 sp-display text-[13px]"
              style={{
                background: tab === t.k ? 'var(--bone-2)' : 'transparent',
                color: tab === t.k ? 'var(--ink)' : 'var(--ink-3)',
                borderRadius: 999,
                boxShadow: tab === t.k ? 'var(--shadow-1)' : 'none',
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {loadError && (
          <div
            className="p-6 text-center space-y-3"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--ember-soft)',
              borderRadius: 'var(--r-3)',
            }}
          >
            <Ustoz size={80} mood="oops" className="mx-auto" />
            <p className="sp-display" style={{ color: 'var(--ink)' }}>
              Yuklab bo‘lmadi
            </p>
            <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
              {loadError}
            </p>
            <button
              type="button"
              onClick={load}
              className="sp-display px-5 py-2.5 min-h-[44px]"
              style={{
                background: 'var(--leaf)',
                color: 'var(--bone)',
                border: '2px solid var(--leaf-deep)',
                borderRadius: 'var(--r-3)',
                boxShadow: '0 4px 0 var(--leaf-deep)',
                fontWeight: 700,
              }}
            >
              Qayta urinish
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sp-skeleton h-16" style={{ borderRadius: 'var(--r-3)' }} />
            ))}
          </div>
        ) : tab === 'friends' ? (
          friends.length === 0 ? (
            <EmptyCard
              title="Hali do‘stlar yo‘q"
              sub="Do‘st qo‘shish uchun yuqoridagi tugmani bosing"
            />
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3"
                  style={{
                    background: 'var(--bone)',
                    border: '1.5px solid var(--line)',
                    borderRadius: 'var(--r-3)',
                    boxShadow: 'var(--shadow-1)',
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center sp-display shrink-0"
                    style={{
                      background: 'var(--sky-soft)',
                      color: 'var(--sky)',
                      border: '2px solid var(--ink)',
                      fontWeight: 800,
                    }}
                  >
                    {getInitials(f.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="sp-display text-sm truncate" style={{ color: 'var(--ink)' }}>
                      {f.name}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {f.role}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChallenge(f.id)}
                    disabled={!!challenging}
                    className="sp-display inline-flex items-center gap-1.5 px-3.5 py-2 text-xs active:translate-y-[1px] transition-transform disabled:opacity-50"
                    style={{
                      background: 'var(--ember)',
                      color: 'var(--bone)',
                      border: '2px solid var(--ember-deep)',
                      borderRadius: 'var(--r-2)',
                      boxShadow: '0 3px 0 var(--ember-deep)',
                      fontWeight: 700,
                    }}
                  >
                    {challenging === f.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Swords size={13} />
                    )}
                    duel
                  </button>
                </div>
              ))}
            </div>
          )
        ) : pending.length === 0 ? (
          <EmptyCard
            title="So‘rov yo‘q"
            sub="Yangi do‘stlik so‘rovlari shu yerda ko‘rinadi"
          />
        ) : (
          <div className="space-y-2">
            {pending.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 p-3"
                style={{
                  background: 'var(--bone)',
                  border: '1.5px solid var(--line)',
                  borderRadius: 'var(--r-3)',
                  boxShadow: 'var(--shadow-1)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center sp-display shrink-0"
                  style={{
                    background: 'var(--gold-tint)',
                    color: 'var(--gold-deep)',
                    border: '2px solid var(--ink)',
                    fontWeight: 800,
                  }}
                >
                  {getInitials(req.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="sp-display text-sm truncate" style={{ color: 'var(--ink)' }}>
                    {req.name}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {req.role}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRespond(req.id, true)}
                  disabled={responding === req.id}
                  className="sp-display px-3.5 py-2 text-xs active:translate-y-[1px] transition-transform disabled:opacity-50"
                  style={{
                    background: 'var(--leaf)',
                    color: 'var(--bone)',
                    border: '2px solid var(--leaf-deep)',
                    borderRadius: 'var(--r-2)',
                    boxShadow: '0 3px 0 var(--leaf-deep)',
                    fontWeight: 700,
                  }}
                >
                  qabul
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(req.id, false)}
                  disabled={responding === req.id}
                  className="sp-display px-3 py-2 text-xs disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--ember-deep)',
                    border: '1.5px solid var(--ember-soft)',
                    borderRadius: 'var(--r-2)',
                    fontWeight: 700,
                  }}
                >
                  rad
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      className="p-8 text-center"
      style={{
        background: 'var(--bone)',
        border: '1.5px solid var(--line)',
        borderRadius: 'var(--r-4)',
      }}
    >
      <Ustoz size={110} mood="calm" className="mx-auto" />
      <p className="sp-display mt-3" style={{ color: 'var(--ink)' }}>
        {title}
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
        {sub}
      </p>
    </div>
  );
}
