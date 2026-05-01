'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Pay = { id: string; month: string; amount: number; paidAt: string };

/**
 * 25.D.4: Compact 12-month payment-history strip for a single student.
 * Shows green/red dots for paid/unpaid in the last 12 months.
 */
export function HistoryStrip({ studentId }: { studentId: string }) {
  const [pays, setPays] = useState<Pay[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Pay[]>(`/payments/${studentId}/status`, {}, token)
      .then((res) => setPays(res.data))
      .catch(() => setPays([]));
  }, [studentId]);

  // Last 12 months as YYYY-MM
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const paidSet = new Set(pays.map((p) => p.month));

  return (
    <div className="flex gap-1">
      {months.map((m) => (
        <span
          key={m}
          title={m}
          className={`w-3 h-3 rounded-full ${
            paidSet.has(m) ? 'bg-emerald-500' : 'bg-rose-300'
          }`}
        />
      ))}
    </div>
  );
}
