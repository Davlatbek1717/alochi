'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, Medal } from 'lucide-react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';
import { getBranchIdFromToken } from '@/lib/jwt';

type Certificate = {
  id: string;
  level: string;
  lessonsCompleted: number;
  issuedAt: string;
  student: { id: string; name: string };
};

const LEVEL_LABEL: Record<string, string> = {
  bronze: "Bronze A'lochi",
  silver: "Silver A'lochi",
  gold: "Gold A'lochi",
  diamond: "Diamond A'lochi",
};

const LEVEL_ICON: Record<string, React.ReactNode> = {
  bronze: <Medal size={22} className="text-amber-700" />,
  silver: <Medal size={22} className="text-[#94a3b8]" />,
  gold: <Award size={22} className="text-yellow-500" />,
  diamond: <Award size={22} className="text-cyan-400" />,
};

export default function ManagerCertificatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBranch, setHasBranch] = useState(true);

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken() ?? '';
    setHasBranch(!!branchId);

    if (!branchId) {
      setLoading(false);
      return;
    }

    apiRequest<Certificate[]>(
      `/gamification/certificates/by-branch/${branchId}`,
      {},
      token,
    )
      .then((r) => setCertificates(r.data ?? []))
      .catch((err) => {
        setCertificates([]);
        toast.error(err instanceof Error ? err.message : 'Sertifikatlar yuklanmadi');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['cert:earned'], load);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/manager')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Manager
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 border border-[#f59e0b]/30 flex items-center justify-center">
              <Award size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Sertifikatlar</p>
              <p className="text-[#94a3b8] text-xs">Filial o&apos;quvchilarining sertifikatlari</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {!hasBranch && !loading ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-rose-800">Filial biriktirilmagan</p>
            <p className="mt-1 text-sm text-rose-700">
              Hisobingiz biror filialga biriktirilmagan. Superadmin orqali filial tayinlanishini so&apos;rang.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} theme="light" className="h-16 w-full rounded-[18px]" />
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Award size={28} />}
              title="Sertifikat yo'q"
              description="Hali sertifikat berilmagan"
              theme="light"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {certificates.map((c) => (
              <li
                key={c.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] flex items-center justify-center shrink-0">
                  {LEVEL_ICON[c.level] ?? <Award size={22} className="text-[#64748b]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/manager/students/${c.student.id}`}
                    className="font-semibold text-[#0f172a] text-sm truncate block hover:underline"
                  >
                    {c.student.name}
                  </Link>
                  <p className="text-xs text-[#64748b] truncate">
                    {LEVEL_LABEL[c.level] ?? c.level} · {c.lessonsCompleted} dars
                  </p>
                  <p className="text-[10px] text-[#94a3b8] mt-0.5">
                    {formatDateNumeric(c.issuedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
