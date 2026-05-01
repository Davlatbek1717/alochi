'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { History } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateNumeric } from '@/lib/date-uz';

type Entry = {
  id: string;
  category: string;
  computedAt: string;
  passRate: number;
  attendanceRate: number;
};

export default function StudentStatusHistoryPage() {
  const params = useParams<{ id: string }>();
  const studentId = params?.id;
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Entry[]>(`/status/history/${studentId}`, {}, token)
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <div className="flex items-center gap-2 mb-4">
        <History size={20} />
        <h1 className="text-xl font-bold text-[#0f172a]">O&apos;quvchi holati tarixi</h1>
      </div>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : items.length === 0 ? (
        <p className="text-[#64748b] text-sm">Tarixda yozuvlar yoʻq</p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li
              key={e.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#0f172a] capitalize">{e.category}</p>
                <p className="text-xs text-[#64748b]">
                  {formatDateNumeric(e.computedAt)}
                </p>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-[#64748b]">
                <span>Pass: {e.passRate}%</span>
                <span>Davomat: {e.attendanceRate}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
