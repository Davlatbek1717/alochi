'use client';
import { useEffect, useState } from 'react';
import { Activity, Users, UserCheck, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Stat, Skeleton, SkeletonStats, EmptyState, useToast } from '@/components/ui';

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
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-44" theme="light" />
        <SkeletonStats count={4} theme="light" />
      </div>
    );
  }

  if (!data || (data.dau === 0 && data.wau === 0 && data.mau === 0)) {
    return (
      <EmptyState
        icon={<Activity size={24} />}
        title="Faollik ma'lumotlari yo'q"
        description="DAU/WAU/MAU hisoblash uchun so'nggi 30 kunda faollik qayd etilmagan"
        theme="light"
      />
    );
  }

  // stickiness comes as 0..1 ratio (e.g. 0.33 = 33%)
  const stickinessPercent = Math.round(data.stickiness * 100);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0f172a]">
        Lifecycle Metrikalari
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          icon={<Activity size={20} />}
          label="DAU"
          value={data.dau}
          sub="Kunlik faol foydalanuvchilar"
          color="text-[#6d28d9]"
          theme="light"
        />
        <Stat
          icon={<Users size={20} />}
          label="WAU"
          value={data.wau}
          sub="Haftalik faol foydalanuvchilar"
          color="text-[#6d28d9]"
          theme="light"
        />
        <Stat
          icon={<UserCheck size={20} />}
          label="MAU"
          value={data.mau}
          sub="Oylik faol foydalanuvchilar"
          color="text-[#6d28d9]"
          theme="light"
        />
        <Stat
          icon={<Zap size={20} />}
          label="Stickiness"
          value={`${stickinessPercent}%`}
          sub="DAU/MAU nisbati"
          color="text-[#6d28d9]"
          theme="light"
        />
      </div>
    </div>
  );
}
