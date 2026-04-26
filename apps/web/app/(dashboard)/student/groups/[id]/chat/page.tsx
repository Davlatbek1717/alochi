'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { apiRequest } from '@/lib/api';

type Reaction = {
  emoji: string;
  count: number;
};

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  reactions?: Reaction[];
};

type Challenge = {
  id: string;
  groupAId: string;
  groupBId: string;
  groupAXp: number;
  groupBXp: number;
  endDate: string;
};

const EMOJIS = ['👍', '❤️', '💪', '🔥', '🎉'];

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params?.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [userRole, setUserRole] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { role?: string };
        setUserRole(parsed.role ?? '');
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();

    const token = localStorage.getItem('accessToken') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const socket = io(`${apiUrl}/social`, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('chat:join', { groupId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:error', (data: { message: string }) => {
      alert(data.message);
    });

    socket.on('challenge:update', (data: { groupAXp: number; groupBXp: number }) => {
      setChallenge((prev) => prev ? { ...prev, ...data } : prev);
    });

    return () => {
      socket.disconnect();
    };
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
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions?.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions?.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r,
              ),
            };
          }
          return {
            ...m,
            reactions: [...(m.reactions ?? []), { emoji, count: 1 }],
          };
        }),
      );
    } catch {
      setReactingTo(messageId);
    }
  }

  const isModerator = userRole === 'mentor' || userRole === 'filadmin' || userRole === 'superadmin';

  async function deleteMsg(msgId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setMenuFor(null);
    try {
      await apiRequest(`/social/groups/${groupId}/messages/${msgId}`, { method: 'DELETE' }, token);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato');
    }
  }

  async function banSender(senderId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setMenuFor(null);
    if (!confirm("Bu foydalanuvchini 24 soatga ban qilasizmi?")) return;
    try {
      await apiRequest(`/social/groups/${groupId}/ban/${senderId}`, {
        method: 'POST',
        body: JSON.stringify({ hours: 24 }),
      }, token);
      alert("Foydalanuvchi 24 soatga ban qilindi");
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Xato');
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
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
      <div className="max-w-lg mx-auto py-10 text-center space-y-3">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => { setError(''); fetchMessages(); }}
          className="text-indigo-600 text-sm underline"
        >
          Qayta urinish
        </button>
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
    <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-80px)]">
      {challenge && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-700">⚔️ Guruh musobaqasi</span>
            <span className="text-xs text-indigo-500">{daysLeft} kun qoldi</span>
          </div>
          <div className="flex items-center gap-1 text-xs mb-1">
            <span className="font-medium text-indigo-700 w-16 text-right">{myXp} XP</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(myXp / total) * 100}%` }}
              />
            </div>
            <span className="font-medium text-gray-500 w-16">{theirXp} XP</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span className="text-indigo-600 font-medium">Sizning guruh</span>
            <span>Raqib guruh</span>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <h1 className="font-semibold text-gray-800">Guruh chati</h1>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
          20 xabar/kun
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-10">Hali xabarlar yo&apos;q</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="space-y-1">
              <div className="relative inline-block max-w-[85%]">
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100">
                  <p className="text-xs text-indigo-600 font-medium mb-0.5">{msg.senderName}</p>
                  <p className="text-sm text-gray-800">{msg.content}</p>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-gray-400">{formatTime(msg.createdAt)}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        😊
                      </button>
                      {isModerator && (
                        <button
                          onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ⚙️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {menuFor === msg.id && isModerator && (
                  <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-sm">
                    <button
                      onClick={() => deleteMsg(msg.id)}
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      🗑 O&apos;chirish
                    </button>
                    <button
                      onClick={() => banSender(msg.senderId)}
                      className="block w-full text-left px-4 py-2 text-orange-600 hover:bg-orange-50"
                    >
                      🚫 Ban (24h)
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
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {msg.reactions && msg.reactions.length > 0 && (
                <div className="flex gap-1 ml-1 flex-wrap">
                  {msg.reactions.map((r) => (
                    <span key={r.emoji} className="bg-gray-100 text-xs px-2 py-0.5 rounded-full">
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

      <div className="bg-white border-t border-gray-100 px-4 py-3">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              placeholder="Xabar yozing..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {input.length}/200
            </span>
          </div>
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
