'use client';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Award } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';

type Certificate = {
  id: string;
  level: string;
  lessonsCompleted: number;
  issuedAt: string;
  student: { id: string; name: string };
};

const LEVEL_LABEL: Record<string, string> = {
  bronze: "🥉 Bronze Adouptivo",
  silver: "🥈 Silver Adouptivo",
  gold: "🥇 Gold Adouptivo",
  diamond: "💎 Diamond Adouptivo",
};

export default function ManagerCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        branchId?: string;
      };
      branchId = u.branchId ?? '';
    } catch {
      /* ignore */
    }

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
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#f7f4ef] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Award size={20} className="text-amber-500" />
        <h1 className="text-xl font-bold text-[#0f172a]">Sertifikatlar</h1>
        {!loading && (
          <span className="ml-auto text-sm text-[#64748b]">
            {certificates.length} ta
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} theme="light" className="h-16 w-full rounded-[18px]" />
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
          <p className="text-[#94a3b8] text-sm">
            Hali sertifikat berilmagan
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {certificates.map((c) => (
            <li
              key={c.id}
              className="bg-white rounded-[18px] border-[1.5px] border-amber-100 p-4 flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Award size={22} className="text-amber-600" />
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
  );
}
