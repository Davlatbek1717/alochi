'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../../_components/DebtorsTable';
import { Skeleton, useToast } from '@/components/ui';
import { tashkentToday } from '@/lib/tashkent-date';

function currentMonth() {
  return tashkentToday().slice(0, 7);
}

function BranchDetailContent() {
  const { branchId } = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments?branchId=${branchId}&month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchStudents(m);
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push(`/superadmin/payments?month=${month}`)}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm"
          >
            <ArrowLeft size={16} /> To&apos;lov Hisoboti
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <CreditCard size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-lg">Filial To&apos;lovlari</p>
            </div>
            <MonthPicker value={month} onChange={handleMonthChange} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6">
        {loading ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} theme="light" className="h-12 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className={`bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}>
            <DebtorsTable students={students} readOnly={true} loading={false} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperadminBranchPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <BranchDetailContent />
    </Suspense>
  );
}
