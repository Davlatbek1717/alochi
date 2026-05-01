'use client';
import { useEffect, useState } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Blocked = {
  id: string;
  name: string;
  login: string;
  status: 'blocked_warning' | 'blocked_payment';
  branchId: string | null;
  phone: string | null;
};

export default function SuperadminBlockedStudentsPage() {
  const [items, setItems] = useState<Blocked[]>([]);
  const [reason, setReason] = useState<'all' | 'warning' | 'payment'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const qs = reason === 'all' ? '' : `?reason=${reason}`;
    setLoading(true);
    apiRequest<Blocked[]>(`/users/blocked${qs}`, {}, token)
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [reason]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <h1 className="text-xl font-bold text-[#0f172a] mb-4">Bloklangan o&apos;quvchilar</h1>
      <div className="flex gap-2 mb-4">
        {(['all', 'warning', 'payment'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              reason === r ? 'bg-[#0f172a] text-white' : 'bg-white text-[#64748b] border border-[#ede9e1]'
            }`}
          >
            {r === 'all' ? 'Hammasi' : r === 'warning' ? 'Ogohlantirish' : "To&apos;lov"}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : items.length === 0 ? (
        <p className="text-[#64748b] text-sm">Bloklangan o&apos;quvchilar yo&apos;q</p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li
              key={u.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-start justify-between"
            >
              <div>
                <p className="font-semibold text-[#0f172a] text-sm">{u.name}</p>
                <p className="text-xs text-[#64748b]">{u.login}</p>
              </div>
              {u.status === 'blocked_warning' ? (
                <ShieldAlert size={18} className="text-amber-500" />
              ) : (
                <Ban size={18} className="text-rose-500" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
