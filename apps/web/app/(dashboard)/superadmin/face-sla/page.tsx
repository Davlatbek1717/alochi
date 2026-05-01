'use client';
import { useEffect, useState, useCallback } from 'react';
import { ScanFace, CheckCircle, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<Sla>('/face/sla', {}, token);
      setSla(res.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ma'lumot olishda xato");
      setSla(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScanFace size={20} />
          <h1 className="text-xl font-bold text-[#0f172a]">Face SLA monitoringi</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 bg-white border-[1.5px] border-[#ede9e1] hover:border-[#0d9488] text-[#0f172a] px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 animate-pulse">
              <div className="h-3 bg-[#f7f4ef] rounded w-2/3 mb-3" />
              <div className="h-7 bg-[#f7f4ef] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white rounded-[18px] border-[1.5px] border-rose-200 p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center">
            <AlertCircle size={24} className="text-rose-500" />
          </div>
          <p className="text-rose-600 font-bold text-sm">Yuklab bo&apos;lmadi</p>
          <p className="text-xs text-[#64748b]">{error}</p>
          <button
            onClick={load}
            className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-xl text-sm font-bold"
          >
            Qayta urinish
          </button>
        </div>
      ) : !sla || sla.totalAttempts === 0 ? (
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#f7f4ef] flex items-center justify-center">
            <Inbox size={24} className="text-[#94a3b8]" />
          </div>
          <p className="text-[#0f172a] font-bold text-sm">Hali ma&apos;lumot yo&apos;q</p>
          <p className="text-xs text-[#64748b]">
            Yuz tanish urinishlari boshlanganidan so&apos;ng SLA ko&apos;rsatkichlari bu yerda paydo bo&apos;ladi.
          </p>
          <button
            onClick={load}
            className="bg-white border-[1.5px] border-[#ede9e1] hover:border-[#0d9488] text-[#0f172a] px-4 py-2 rounded-xl text-sm font-bold"
          >
            Qayta tekshirish
          </button>
        </div>
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
              O&apos;rtacha confidence
            </p>
            <p className="text-2xl font-bold text-[#0f172a]">{sla.avgConfidence}</p>
          </div>
        </div>
      )}
    </div>
  );
}
