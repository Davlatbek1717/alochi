'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, History, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateNumeric } from '@/lib/date-uz';
import { Skeleton, EmptyState } from '@/components/ui';

type Entry = {
  id: string;
  category: string;
  computedAt: string;
  passRate: number;
  attendanceRate: number;
};

type UserInfo = { id: string; name: string };

export default function StudentStatusHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = params?.id;
  const [items, setItems] = useState<Entry[]>([]);
  const [student, setStudent] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!studentId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    setError(null);
    Promise.all([
      apiRequest<Entry[]>(`/status/history/${studentId}`, {}, token),
      apiRequest<UserInfo>(`/users/${studentId}`, {}, token).catch(() => ({ data: null })),
    ])
      .then(([histRes, userRes]) => {
        setItems(histRes.data ?? []);
        setStudent(userRes.data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push(`/filadmin/students/${studentId}`)}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> O&apos;quvchi
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
              <History size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                {student?.name ?? 'Oʻquvchi'}
              </p>
              <p className="text-white text-lg font-bold">Holat tarixi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-rose-700">Xato yuz berdi</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={load}
              className="text-xs font-bold text-rose-700 hover:underline shrink-0"
            >
              Qayta urinish
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[18px]" theme="light" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<History size={28} />}
              title="Tarixda yozuvlar yo'q"
              description="Hali hech qanday holat qayd etilmagan"
              theme="light"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((e) => (
              <li
                key={e.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4"
              >
                <div className="flex items-center justify-between min-w-0">
                  <p className="font-semibold text-[#0f172a] capitalize truncate">{e.category}</p>
                  <p className="text-xs text-[#64748b] shrink-0 ml-2">
                    {formatDateNumeric(e.computedAt)}
                  </p>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-[#64748b]">
                  <span>O&apos;tish darajasi: {e.passRate}%</span>
                  <span>Davomat: {e.attendanceRate}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
