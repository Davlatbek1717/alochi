'use client';
import { useEffect, useState } from 'react';
import { ScanFace, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Sla = {
  totalAttempts: number;
  successRate: number;
  avgConfidence: number;
  days: number;
};

export default function FaceSlaPage() {
  const [sla, setSla] = useState<Sla | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Sla>('/face/sla', {}, token)
      .then((res) => setSla(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <div className="flex items-center gap-2 mb-4">
        <ScanFace size={20} />
        <h1 className="text-xl font-bold text-[#0f172a]">Face SLA monitoringi</h1>
      </div>
      {loading ? (
        <p className="text-[#64748b] text-sm">Yuklanmoqda...</p>
      ) : !sla ? (
        <p className="text-[#64748b] text-sm">Maʼlumot yoʻq</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
            <p className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-2">
              Urinishlar ({sla.days} kun)
            </p>
            <p className="text-2xl font-bold text-[#0f172a]">{sla.totalAttempts}</p>
          </div>
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
            <p className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
              {sla.successRate >= 95 ? (
                <CheckCircle size={12} className="text-emerald-500" />
              ) : (
                <AlertCircle size={12} className="text-rose-500" />
              )}
              Muvaffaqiyat
            </p>
            <p className="text-2xl font-bold text-[#0f172a]">{sla.successRate}%</p>
          </div>
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 col-span-2">
            <p className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-2">
              Oʻrtacha confidence
            </p>
            <p className="text-2xl font-bold text-[#0f172a]">{sla.avgConfidence}</p>
          </div>
        </div>
      )}
    </div>
  );
}
