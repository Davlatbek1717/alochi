'use client';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  useEffect(() => {
    const t = token();
    if (!t) return;
    apiRequest<Notif[]>('/notifications/my', {}, t)
      .then((res) => {
        setNotifs(res.data.slice(0, 5));
        setUnread(res.data.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markAll() {
    const t = token();
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' }, t);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  const TYPE_ICON: Record<string, string> = {
    warning: '⚠️',
    blocked: '🔴',
    delegation: '📋',
    task: '✅',
  };

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1 text-gray-500 hover:text-gray-800"
        aria-label="Bildirishnomalar"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">Bildirishnomalar</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-indigo-600 font-medium">
                Hammasini o&apos;qi
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-6">Bildirishnomalar yo&apos;q</p>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-2.5 ${n.isRead ? '' : 'bg-indigo-50/50'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
