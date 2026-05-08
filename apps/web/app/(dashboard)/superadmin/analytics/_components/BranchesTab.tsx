'use client';
import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface BranchStat {
  branchId: string;
  branchName: string;
  totalStudents: number;
  totalSessions: number;
  lessonsPassed: number;
  passRate: number;
}

const columns: Column<BranchStat>[] = [
  {
    key: 'branchName',
    label: 'Filial',
    render: (row) => (
      <span className="font-medium text-[#0f172a]">{row.branchName}</span>
    ),
  },
  {
    key: 'totalStudents',
    label: "Faol o'quvchilar",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-[#0f172a]">{row.totalStudents}</span>
    ),
  },
  {
    key: 'totalSessions',
    label: 'Jami sessiya',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#64748b]">{row.totalSessions}</span>
    ),
  },
  {
    key: 'lessonsPassed',
    label: "O'tilgan darslar",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#6d28d9] font-semibold">{row.lessonsPassed}</span>
    ),
  },
  {
    key: 'passRate',
    label: 'Pass rate',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span
        className={
          row.passRate >= 70
            ? 'text-emerald-600 font-semibold'
            : row.passRate >= 50
              ? 'text-amber-600 font-semibold'
              : 'text-rose-600 font-semibold'
        }
      >
        {row.passRate}%
      </span>
    ),
  },
];

export function BranchesTab() {
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<BranchStat[]>('/analytics/branches', {}, token)
      .then((r) => setBranches(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" theme="light" />
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={[]}
          keyField="branchId"
          loading
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0f172a]">
        Filiallar Taqqoslash
      </h2>
      {branches.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} />}
          title="Filiallar statistikasi yo'q"
          description="Hali birorta filial uchun ma'lumot yig'ilmagan"
          theme="light"
        />
      ) : (
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={branches as unknown as Record<string, unknown>[]}
          keyField="branchId"
        />
      )}
    </div>
  );
}
