'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../_components/DebtorsTable';
import { Button, useToast } from '@/components/ui';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getBranchAndToken(): { branchId: string; token: string } {
  const token = localStorage.getItem('accessToken') ?? '';
  let branchId = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    branchId = payload.branchId ?? '';
  } catch {
    // branchId stays empty
  }
  return { branchId, token };
}

export default function ManagerPaymentsPage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const { branchId, token } = getBranchAndToken();
    if (!branchId) {
      setError('Filial biriktirilmagan');
      setLoading(false);
      return;
    }
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments?branchId=${branchId}&month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <button onClick={() => router.push('/manager')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Manager
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <CreditCard size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-lg">To&apos;lov Holati</p>
            </div>
            <MonthPicker value={month} onChange={handleMonthChange} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6">
        {error ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
            <p className="text-[#e11d48] text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-[#0f172a]"
              onClick={() => fetchStudents(month)}
            >
              Qayta urinish
            </Button>
          </div>
        ) : (
          <div className={`bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}>
            <DebtorsTable
              students={students}
              readOnly={true}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
