'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type AuditLogEntry = {
  id: string;
  action: string;
  actor: string;
  detail?: string;
  createdAt: string;
};

type TimelineEvent = {
  time: string;
  icon: string;
  actor: string;
  action: string;
  detail: string;
};

const ACTION_ICONS: Record<string, string> = {
  created: '📤',
  accepted: '✅',
  warning: '⚠️',
  payment: '💳',
  rejected: '❌',
  cancelled: '🚫',
};

function getIcon(action: string): string {
  const key = Object.keys(ACTION_ICONS).find((k) => action.toLowerCase().includes(k));
  return key ? ACTION_ICONS[key] : '📋';
}

function formatTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString('uz-UZ', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

export default function DelegationDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchAuditLog() {
      try {
        const res = await apiRequest<AuditLogEntry[]>(`/delegations/${id}/audit-log`, {}, token);
        const mapped: TimelineEvent[] = res.data.map((entry) => ({
          time: formatTime(entry.createdAt),
          icon: getIcon(entry.action),
          actor: entry.actor,
          action: entry.action,
          detail: entry.detail ?? '',
        }));
        setTimeline(mapped);
      } catch {
        // keep empty timeline on error
      } finally {
        setLoading(false);
      }
    }

    fetchAuditLog();
  }, [id]);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/delegations" className="text-gray-400 hover:text-gray-600">←</Link>
        <div>
          <h1 className="text-xl font-bold">Nodira → Alisher</h1>
          <p className="text-sm text-gray-500">3–10 may • 🟢 Faol</p>
        </div>
        <div className="ml-auto">
          <button className="text-indigo-600 text-sm border border-indigo-200 px-3 py-1 rounded-lg">
            📄 PDF
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 text-sm space-y-1">
        <p><span className="font-medium">Sabab:</span> &quot;Filadmin ta&apos;tilda&quot;</p>
        <p><span className="font-medium">Ruxsatlar:</span> Ogohlantirish, To&apos;lov, Xodim boshqaruv</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Yuklanmoqda...</p>
      ) : (
        <div className="space-y-1">
          {timeline.length === 0 && (
            <p className="text-center text-gray-400 py-8">Voqealar topilmadi</p>
          )}
          {timeline.map((event, i) => (
            <div key={i} className="flex gap-3 py-3 border-b last:border-0">
              <div className="text-2xl">{event.icon}</div>
              <div>
                <p className="text-xs text-gray-400">{event.time}</p>
                <p className="font-medium">{event.actor} — {event.action}</p>
                <p className="text-sm text-gray-500">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
