'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../_components/DebtorsTable';

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

export default function FiladminPaymentsPage() {
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
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchStudents(m);
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
    await fetchStudents(month);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">To&apos;lov Holati</h1>
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
          <DebtorsTable
            students={students}
            readOnly={false}
            onMarkPaid={handleMarkPaid}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
