'use client';
import { useEffect, useState } from 'react';
import { Activity, Users, UserCheck, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Stat, SkeletonStats, EmptyState, useToast } from '@/components/ui';

interface Lifecycle {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

export function LifecycleTab() {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lifecycle>('/analytics/lifecycle', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-44 bg-slate-700/50 rounded animate-pulse" />
        <SkeletonStats count={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={<Activity size={24} />}
        title="Lifecycle ma'lumotlari yo'q"
        description="DAU/WAU/MAU hisoblash uchun yetarli ma'lumot yig'ilmagan"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Lifecycle Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={<Activity size={20} />}
          label="DAU"
          value={data.dau}
          sub="Daily Active Users"
          color="text-emerald-400"
        />
        <Stat
          icon={<Users size={20} />}
          label="WAU"
          value={data.wau}
          sub="Weekly Active Users"
          color="text-blue-400"
        />
        <Stat
          icon={<UserCheck size={20} />}
          label="MAU"
          value={data.mau}
          sub="Monthly Active Users"
          color="text-purple-400"
        />
        <Stat
          icon={<Zap size={20} />}
          label="Stickiness"
          value={`${(data.stickiness * 100).toFixed(0)}%`}
          sub="DAU/MAU ratio"
          color="text-amber-400"
        />
      </div>
    </div>
  );
}
