'use client';
// Re-uses the same UX as superadmin variant; backend scopes to filadmin's branch.
import { useEffect, useState } from 'react';
import { Ban, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Blocked = {
  id: string;
  name: string;
  login: string;
  status: 'blocked_warning' | 'blocked_payment';
  branchId: string | null;
};

export default function FiladminBlockedStudentsPage() {
  const [items, setItems] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Blocked[]>(`/users/blocked`, {}, token)
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <h1 className="text-xl font-bold text-[#0f172a] mb-4">Bloklangan o&apos;quvchilar</h1>
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
