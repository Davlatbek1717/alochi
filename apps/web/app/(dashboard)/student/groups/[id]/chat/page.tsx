'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Send, Smile, MoreVertical, Trash2, Ban, Swords } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatTime as formatTimeUtil } from '@/lib/date-uz';
import { Mascot, Modal, useToast } from '@/components/ui';

type Reaction = { emoji: string; count: number };
type Message = {
  id: string; senderId: string; senderName: string;
  content: string; createdAt: string; reactions?: Reaction[];
};
type Challenge = {
  id: string; groupAId: string; groupBId: string;
  groupAXp: number; groupBXp: number; endDate: string;
};

const EMOJIS = ['👍', '❤️', '💪', '🔥', '🎉'];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params?.id as string;
  const toast = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [userRole, setUserRole] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

  // Ban confirmation modal state
  const [banTarget, setBanTarget] = useState<{ id: string; name: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const [msgRes, chalRes] = await Promise.all([
        apiRequest<Message[]>(`/social/groups/${groupId}/messages`, {}, token),
        apiRequest<Challenge>(`/social/challenges/active/${groupId}`, {}, token).catch(() => null),
      ]);
      setMessages(msgRes.data);
      if (chalRes) setChallenge(chalRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xabarlarni yuklashda xato');
    } finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUserRole((JSON.parse(stored) as { role?: string }).role ?? ''); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();
    const token = localStorage.getItem('accessToken') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const socket = io(`${apiUrl}/social`, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => { setConnected(true); socket.emit('chat:join', { groupId }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('chat:message', (msg: Message) => setMessages((prev) => [...prev, msg]));
    socket.on('chat:error', (data: { message: string }) => toast.error(data.message));
    socket.on('challenge:update', (data: { groupAXp: number; groupBXp: number }) => {
      setChallenge((prev) => prev ? { ...prev, ...data } : prev);
    });
    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !connected) return;
    socketRef.current?.emit('chat:send', { groupId, content: input.trim() });
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') sendMessage();
  }

  async function handleReact(messageId: string, emoji: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setReactingTo(null);
    try {
      await apiRequest(`/social/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      }, token);
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions?.find((r) => r.emoji === emoji);
        if (existing) {
          return { ...m, reactions: m.reactions?.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) };
        }
        return { ...m, reactions: [...(m.reactions ?? []), { emoji, count: 1 }] };
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reaktsiya qo\'shilmadi');
    }
  }

  const isModerator = userRole === 'mentor' || userRole === 'filadmin' || userRole === 'superadmin';

  async function deleteMsg(msgId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setMenuFor(null);
    try {
      await apiRequest(`/social/groups/${groupId}/messages/${msgId}`, { method: 'DELETE' }, token);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      toast.success("Xabar o'chirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xabarni o\'chirib bo\'lmadi');
    }
  }

  async function confirmBan() {
    if (!banTarget) return;
    const token = localStorage.getItem('accessToken') ?? '';
    const { id: senderId } = banTarget;
    setBanTarget(null);
    try {
      await apiRequest(`/social/groups/${groupId}/ban/${senderId}`, {
        method: 'POST',
        body: JSON.stringify({ hours: 24 }),
      }, token);
      toast.success('Foydalanuvchi 24 soatga ban qilindi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ban qo\'shib bo\'lmadi');
    }
  }

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Mascot expression="idle" size={80} animated />
          <p className="text-[#64748b] font-semibold text-sm">Xabarlar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-3">
          <Mascot expression="sad" size={88} className="mx-auto" />
          <p className="text-[#0f172a] font-extrabold text-base">Chat yuklanmadi</p>
          <p className="text-rose-500 text-sm">{error}</p>
          <p className="text-[#64748b] text-xs">Internet aloqasini tekshiring</p>
          <button
            onClick={() => { setError(''); fetchMessages(); }}
            className="bg-[#58cc02] text-white px-5 py-2.5 rounded-xl text-sm font-extrabold border-b-[3px] border-[#46a302] hover:brightness-105 transition-all min-h-[44px]"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  const isGroupA = challenge?.groupAId === groupId;
  const myXp = challenge ? (isGroupA ? challenge.groupAXp : challenge.groupBXp) : 0;
  const theirXp = challenge ? (isGroupA ? challenge.groupBXp : challenge.groupAXp) : 0;
  const total = myXp + theirXp || 1;
  const daysLeft = challenge
    ? Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <>
      {/* Ban confirmation modal */}
      <Modal
        open={Boolean(banTarget)}
        onClose={() => setBanTarget(null)}
        title="Foydalanuvchini ban qilish"
        theme="light"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setBanTarget(null)}
              className="px-4 py-2 text-sm font-bold text-[#64748b] hover:text-[#0f172a]"
            >
              Bekor qilish
            </button>
            <button
              onClick={confirmBan}
              className="px-4 py-2 rounded-xl text-sm font-extrabold text-white bg-[#f59e0b] border-b-[3px] border-[#d97706] hover:brightness-105 transition-all min-h-[44px]"
            >
              24 soat ban
            </button>
          </>
        }
      >
        <p className="text-sm text-[#64748b] font-semibold">
          <strong>{banTarget?.name}</strong> ni 24 soatga ban qilasizmi?
          Bu foydalanuvchi chat yoza olmaydi.
        </p>
      </Modal>

      <div className="flex flex-col h-full bg-[#f7f4ef] lg:flex-row lg:items-stretch">
        {/* Main chat column — full width on mobile, 60% on desktop */}
        <div className="flex flex-col flex-1 lg:max-w-[60%] h-full min-h-0">
        {/* Header */}
        <div className="bg-[#0f172a] px-5 pt-5 pb-4 md:px-8 md:py-6 relative overflow-hidden shrink-0">
          <div
            className="absolute top-0 right-0 w-40 h-40 md:w-64 md:h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
          />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-0.5">O&apos;quvchi</p>
              <p className="text-white font-bold text-lg">Guruh chati</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#58cc02]' : 'bg-[#475569]'}`} />
              <span className="text-xs text-[#94a3b8]">{connected ? 'Ulangan' : 'Ulanmoqda...'}</span>
            </div>
          </div>

          {/* Challenge bar */}
          {challenge && (
            <div className="relative z-10 mt-3 bg-[#162032] rounded-[14px] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Swords size={12} className="text-[#58cc02]" />
                  <span className="text-xs font-semibold text-white">Guruh musobaqasi</span>
                </div>
                <span className="text-[#94a3b8] text-xs">{daysLeft} kun</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white font-mono w-14 text-right">{myXp}</span>
                <div className="flex-1 h-1.5 bg-[#0f172a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#58cc02] rounded-full transition-all"
                    style={{ width: `${(myXp / total) * 100}%` }}
                  />
                </div>
                <span className="text-[#94a3b8] font-mono w-14">{theirXp}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#58cc02]">Sizning guruh</span>
                <span className="text-[#94a3b8]">Raqib guruh</span>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3 md:py-4 space-y-3 md:space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-[#94a3b8] text-sm mt-10">Hali xabarlar yo&apos;q</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="relative inline-block max-w-[85%]">
                  <div className="bg-white rounded-[14px] rounded-tl-sm px-3 py-2.5 border-[1.5px] border-[#ede9e1]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-[9px] font-black">
                        {getInitials(msg.senderName)}
                      </div>
                      <p className="text-xs font-semibold text-[#58cc02]">{msg.senderName}</p>
                    </div>
                    <p className="text-sm text-[#0f172a]">{msg.content}</p>
                    <div className="flex items-center justify-between gap-3 mt-1.5">
                      <p className="text-[10px] text-[#94a3b8]">{formatTimeUtil(msg.createdAt)}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                          className="w-6 h-6 flex items-center justify-center text-[#94a3b8] hover:text-[#0f172a]"
                          aria-label="Reaktsiya qo'shish"
                        >
                          <Smile size={13} />
                        </button>
                        {isModerator && (
                          <button
                            onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)}
                            className="w-6 h-6 flex items-center justify-center text-[#94a3b8] hover:text-[#0f172a]"
                            aria-label="Amallar"
                          >
                            <MoreVertical size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {menuFor === msg.id && isModerator && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-white border-[1.5px] border-[#ede9e1] rounded-[14px] shadow-lg overflow-hidden text-sm min-w-[140px]">
                      <button
                        onClick={() => deleteMsg(msg.id)}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} /> O&apos;chirish
                      </button>
                      <button
                        onClick={() => { setMenuFor(null); setBanTarget({ id: msg.senderId, name: msg.senderName }); }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-amber-600 hover:bg-amber-50"
                      >
                        <Ban size={13} /> Ban (24h)
                      </button>
                    </div>
                  )}
                </div>

                {reactingTo === msg.id && (
                  <div className="flex gap-1 ml-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className="text-xl hover:scale-125 transition-transform"
                        aria-label={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex gap-1 ml-1 flex-wrap">
                    {msg.reactions.map((r) => (
                      <span key={r.emoji} className="bg-white border border-[#ede9e1] text-xs px-2 py-0.5 rounded-full">
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-[#ede9e1] px-4 py-3 shrink-0">
          <div className="flex gap-2 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 200))}
                onKeyDown={handleKeyDown}
                placeholder={connected ? 'Xabar yozing...' : 'Internet aloqasini tekshiring'}
                aria-label="Xabar yozing"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 pr-14 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#94a3b8] font-mono">
                {input.length}/200
              </span>
            </div>
            <button
              onClick={sendMessage}
              disabled={!connected || !input.trim()}
              aria-label="Xabar yuborish"
              className="w-11 h-11 bg-[#0f172a] text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        </div>{/* end main chat column */}

        {/* Tablet/Desktop sidebar — participant list placeholder */}
        <div className="hidden md:flex md:flex-col md:w-64 lg:flex-1 bg-[#f0ede8] border-l border-[#ede9e1] p-5">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-3">
            Ishtirokchilar
          </p>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#e2ddd5] mx-auto flex items-center justify-center">
                <span className="text-2xl" aria-hidden>👥</span>
              </div>
              <p className="text-xs font-semibold text-[#94a3b8] leading-snug">
                Ishtirokchilar ro&apos;yxati<br />tez orada
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
