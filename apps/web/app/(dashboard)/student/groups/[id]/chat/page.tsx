'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type Reaction = {
  emoji: string;
  count: number;
};

type Message = {
  id: string;
  senderName: string;
  content: string;
  createdAt: string;
  reactions?: Reaction[];
};

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params?.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Message[]>(`/social/groups/${groupId}/messages`, {}, token);
      setMessages(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xabarlarni yuklashda xato');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    fetchMessages();

    const token = localStorage.getItem('accessToken') ?? '';
    const ws = new WebSocket(`ws://localhost:3001/social?token=${token}&groupId=${groupId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'message') {
          setMessages((prev) => [...prev, data.message as Message]);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, [groupId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function sendMessage() {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'message', content: input.trim() }));
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
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...(m.reactions ?? []), { emoji, count: 1 }],
          };
        })
      );
    } catch {
      // ignore reaction errors
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
      <div className="max-w-lg mx-auto py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-80px)]">
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
              <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm border border-gray-100 inline-block max-w-[85%]">
                <p className="text-xs text-indigo-600 font-medium mb-0.5">{msg.senderName}</p>
                <p className="text-sm text-gray-800">{msg.content}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-gray-400">{formatTime(msg.createdAt)}</p>
                  <button
                    onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    😊
                  </button>
                </div>
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
                    <span
                      key={r.emoji}
                      className="bg-gray-100 text-xs px-2 py-0.5 rounded-full"
                    >
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
