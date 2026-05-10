'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  XCircle,
  ClipboardList,
  CheckCircle,
  Award,
  Video,
  Zap,
  Trophy,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Button } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  warning:       <AlertTriangle size={14} className="text-amber-400" />,
  blocked:       <XCircle size={14} className="text-rose-400" />,
  delegation:    <ClipboardList size={14} className="text-blue-400" />,
  task:          <CheckCircle size={14} className="text-emerald-400" />,
  cert_earned:   <Award size={14} className="text-amber-400" />,
  video_missed:  <Video size={14} className="text-rose-400" />,
  xp_updated:    <Zap size={14} className="text-amber-400" />,
  challenge_win: <Trophy size={14} className="text-emerald-400" />,
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const dropRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : '';
    if (!t) return;
    apiRequest<Notif[]>('/notifications/my', {}, t)
      .then((res) => {
        setNotifs(res.data.slice(0, 5));
        setUnread(res.data.filter((n) => !n.isRead).length);
      })
      .catch(() => {
        // The bell is a passive surface — a transient API failure
        // shouldn't toast. Stale-but-not-empty list survives until
        // the next tab focus or socket event.
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when the user comes back to the tab.
  useFocusRevalidate(load);

  // Live: socket events that produce a Notification row server-side
  // also dispatch alochi:revalidate via DuelNotificationProvider, so
  // the bell can pick up new items without polling.
  useRevalidateOnEvent(
    ['cert:earned', 'videocheckin:updated', 'status:updated', 'kpi:updated'],
    load,
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markAll() {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' }, localStorage.getItem('accessToken') ?? '');
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg"
        aria-label="Bildirishnomalar"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-[#e11d48] text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Bildirishnomalar menyusi" className="absolute right-0 top-full mt-2 w-72 bg-[#0f172a] rounded-[18px] shadow-2xl border border-white/10 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Bildirishnomalar</p>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAll}
                className="text-indigo-400 hover:text-indigo-300 !text-xs !px-2 !py-1"
              >
                Hammasini o&apos;qi
              </Button>
            )}
          </div>

          {notifs.length === 0 ? (
            <EmptyState
              icon={<Bell size={22} />}
              title="Bildirishnomalar yo'q"
              className="py-8"
            />
          ) : (
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
              {notifs.map((n) => (
                <div key={n.id} className={`px-4 py-3 transition-colors ${!n.isRead ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      {TYPE_ICON[n.type] ?? <Bell size={12} className="text-[#94a3b8]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                      <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                    {!n.isRead && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0 mt-1.5" />}
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
