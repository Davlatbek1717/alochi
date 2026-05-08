'use client';
import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface TenantRow {
  tenantId: string;
  tenantName: string;
  activeStudents: number;
  dau: number;
  eventsLast30d: number;
}

const columns: Column<TenantRow>[] = [
  {
    key: 'tenantName',
    label: 'Markaz',
    render: (row) => (
      <span className="font-semibold text-[#0f172a]">{row.tenantName}</span>
    ),
  },
  {
    key: 'activeStudents',
    label: "Faol o'quvchilar",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#6d28d9] font-semibold">{row.activeStudents}</span>
    ),
  },
  {
    key: 'dau',
    label: 'DAU',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-[#0f172a]">{row.dau}</span>
    ),
  },
  {
    key: 'eventsLast30d',
    label: "Event'lar (30 kun)",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#64748b]">{row.eventsLast30d}</span>
    ),
  },
];

export function ComparisonTab() {
  const [data, setData] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<TenantRow[]>('/analytics/comparison', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" theme="light" />
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={[]}
          keyField="tenantId"
          loading
        />
      </div>
    );
  }

  // Sort by active students descending (Postgres-backed, always non-zero when data exists)
  const sorted = [...data].sort((a, b) => b.activeStudents - a.activeStudents);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0f172a]">
        Markazlar Taqqoslash
      </h2>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} />}
          title="Markazlar yo'q"
          description="Hali birorta markaz ro'yxatda yo'q"
          theme="light"
        />
      ) : (
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={sorted as unknown as Record<string, unknown>[]}
          keyField="tenantId"
        />
      )}
    </div>
  );
}
