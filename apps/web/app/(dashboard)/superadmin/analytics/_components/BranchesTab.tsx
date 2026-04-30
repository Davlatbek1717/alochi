'use client';
import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface BranchStat {
  branchId: string;
  activeStudents: number;
  avgStreak: number;
  avgXp: number;
}

const columns: Column<BranchStat>[] = [
  {
    key: 'branchId',
    label: 'Filial',
    render: (row) => <span className="font-mono text-xs text-slate-400">{row.branchId.slice(0, 8)}…</span>,
  },
  {
    key: 'activeStudents',
    label: "Faol o'quvchilar",
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-white font-semibold">{row.activeStudents}</span>,
  },
  {
    key: 'avgStreak',
    label: "O'rt. streak",
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-blue-400">{row.avgStreak}</span>,
  },
  {
    key: 'avgXp',
    label: "O'rt. XP",
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-purple-400">{row.avgXp}</span>,
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
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Table columns={columns as unknown as Column<Record<string, unknown>>[]} data={[]} keyField="branchId" loading />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Filiallar Taqqoslash</h2>
      {branches.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} />}
          title="Filiallar statistikasi yo'q"
          description="Hali birorta filial uchun ma'lumot yig'ilmagan"
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
