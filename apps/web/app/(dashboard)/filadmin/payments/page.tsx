'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../_components/DebtorsTable';
import { Button, useToast } from '@/components/ui';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

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

export default function FiladminPaymentsPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-[#f7f4ef]" />}>
      <PaymentsInner />
    </Suspense>
  );
}

function PaymentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { error: toastError, success } = useToast();
  const initialMonth = (() => {
    const q = searchParams?.get('month');
    if (q && MONTH_PATTERN.test(q)) return q;
    return currentMonth();
  })();
  const [month, setMonth] = useState(initialMonth);
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
    // Reflect month in URL so it's bookmarkable / shareable.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('month', m);
      router.replace(`${url.pathname}${url.search}`);
    }
  }

  async function handleMarkPaid(studentId: string, amount: number) {
    const { token } = getBranchAndToken();
    let tenantId = '';
    let recordedBy = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        tenantId?: string;
        id?: string;
      };
      tenantId = user.tenantId ?? '';
      recordedBy = user.id ?? '';
    } catch {
      // keep empty
    }
    try {
      await apiRequest(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            studentId,
            recordedBy,
            month,
            amount,
            paidAt: new Date().toISOString(),
          }),
        },
        token,
      );
      success("To'lov qayd etildi");
      await fetchStudents(month);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "To'lovni saqlashda xatolik");
    }
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
          <button onClick={() => router.push('/filadmin')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center justify-between">
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
              readOnly={false}
              onMarkPaid={handleMarkPaid}
              loading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
