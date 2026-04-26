'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';

interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  unpaid: number;
  blocked: number;
  totalCollected: number;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function BranchCard({ summary, month }: { summary: BranchPaymentSummary; month: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/superadmin/payments/${summary.branchId}?month=${month}`)}
      className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full"
    >
      <h3 className="font-semibold text-gray-900 mb-2">{summary.branchName}</h3>
      {summary.total === 0 ? (
        <p className="text-sm text-gray-400">O&apos;quvchilar yo&apos;q</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">{summary.total} o&apos;quvchi</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-3">
            <span className="text-green-600">✅ {summary.paid} to&apos;lagan</span>
            <span className="text-gray-600">❌ {summary.unpaid} qarzdor</span>
            <span className="text-red-600">🔒 {summary.blocked} bloklangan</span>
          </div>
          <p className="text-sm font-medium text-indigo-600">
            Yig&apos;ilgan: {summary.totalCollected.toLocaleString()} so&apos;m
          </p>
        </>
      )}
    </button>
  );
}

function SuperadminPaymentsContent() {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [summaries, setSummaries] = useState<BranchPaymentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchSummary(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchPaymentSummary[]>(
        `/payments/summary?month=${selectedMonth}`,
        {},
        token,
      );
      setSummaries(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchSummary(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchSummary(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">To&apos;lov Hisoboti</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchSummary(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-40 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <p className="text-gray-400 text-sm">Filiallar topilmadi</p>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          {summaries.map((s) => (
            <BranchCard key={s.branchId} summary={s} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperadminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <SuperadminPaymentsContent />
    </Suspense>
  );
}
