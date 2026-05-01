'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Users, GraduationCap, Ban, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Stats = {
  branchId: string;
  students: {
    total: number;
    active: number;
    blockedWarning: number;
    blockedPayment: number;
  };
  staff: { mentors: number; managers: number };
};

export default function BranchStatsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params?.id;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Stats>(`/branches/${branchId}/stats`, {}, token)
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchId]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <h1 className="text-xl font-bold text-[#0f172a] mb-5">Filial statistikasi</h1>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : !stats ? (
        <p className="text-[#64748b] text-sm">Maʼlumot topilmadi</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Users size={18} />} label="Jami o'quvchilar" value={stats.students.total} />
          <StatCard icon={<GraduationCap size={18} />} label="Faol o'quvchilar" value={stats.students.active} />
          <StatCard icon={<ShieldAlert size={18} className="text-amber-500" />} label="Ogohlantirish bilan blok" value={stats.students.blockedWarning} />
          <StatCard icon={<Ban size={18} className="text-rose-500" />} label="To'lov bilan blok" value={stats.students.blockedPayment} />
          <StatCard icon={<Users size={18} />} label="Mentorlar" value={stats.staff.mentors} />
          <StatCard icon={<Users size={18} />} label="Menejerlar" value={stats.staff.managers} />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
      <div className="flex items-center gap-2 mb-2 text-[#64748b] text-xs uppercase tracking-wider font-semibold">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
