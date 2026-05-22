'use client';
import { useEffect, useState, useCallback } from 'react';
import { ScanFace, CheckCircle, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';

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
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <ScanFace size={18} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white font-bold text-lg">Face SLA monitoringi</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Yangilash
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6">
        {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} theme="light" className="h-20 rounded-[18px]" />
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
            <p className={`text-2xl font-bold ${sla.avgConfidence >= 0.8 ? 'text-[#15803d]' : 'text-rose-600'}`}>
              {(sla.avgConfidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

