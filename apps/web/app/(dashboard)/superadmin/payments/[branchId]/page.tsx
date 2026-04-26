'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../../_components/DebtorsTable';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function BranchDetailContent() {
  const { branchId } = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments/branch/${branchId}?month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
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
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href={`/superadmin/payments?month=${month}`}
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        &larr; Orqaga
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Filial To&apos;lovlari</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchStudents(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <div
          className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          <DebtorsTable students={students} readOnly={true} loading={loading} />
        </div>
      )}
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
