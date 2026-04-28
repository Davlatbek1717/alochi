'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import { EnrollmentCamera } from './_components/EnrollmentCamera';

export default function EnrollPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'intro' | 'camera' | 'uploading' | 'done'>('intro');
  const [error, setError] = useState('');

  async function handleImages(images: string[]) {
    setStage('uploading');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      let userId = '';
      let tenantId = '';
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload.userId || payload.sub || '';
          tenantId = payload.tenantId || '';
        } catch { /* JWT parse failed */ }
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/face/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, tenant_id: tenantId, images_base64: images, enrolled_via: 'web' }),
      });
      if (!res.ok) throw new Error("Ro'yxatdan o'tkazib bo'lmadi");
      setStage('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      setStage('camera');
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <Camera size={18} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Profil</p>
              <p className="text-white font-bold text-lg">Yuz ID</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {stage === 'intro' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#0d9488]/10 border-2 border-[#0d9488]/20 flex items-center justify-center mx-auto">
              <Camera size={30} className="text-[#0d9488]" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-bold text-[#0f172a] text-lg">Ro&apos;yxatga olish</p>
              <p className="text-sm text-[#64748b] leading-relaxed">
                Bu jarayon 1 daqiqa davom etadi. Kamera 5 ta turli burchakdan rasmingizni oladi.
              </p>
            </div>
            <div className="flex items-start gap-3 bg-[#f7f4ef] rounded-xl px-4 py-3">
              <ShieldCheck size={16} className="text-[#0d9488] mt-0.5 shrink-0" />
              <p className="text-xs text-[#64748b] leading-relaxed">
                Faqat matematik vektorlar saqlanadi — asl rasmingiz saqlanmaydi (PDPL §533)
              </p>
            </div>
            <button
              onClick={() => setStage('camera')}
              className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm"
            >
              Boshlash
            </button>
          </div>
        )}

        {stage === 'camera' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
            {error && (
              <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
            )}
            <EnrollmentCamera onComplete={handleImages} />
          </div>
        )}

        {stage === 'uploading' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin mx-auto" />
            <p className="text-[#64748b] text-sm font-medium">Yuklanmoqda...</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-lg text-[#0f172a]">Muvaffaqiyatli saqlandi!</p>
              <p className="text-[#64748b] text-sm mt-1 leading-relaxed">
                Ertadan boshlab filial kirishida avtomatik aniqlanasiz.
              </p>
            </div>
            <button
              onClick={() => router.push('/profile')}
              className="w-full bg-[#0f172a] text-white py-3.5 rounded-xl font-bold text-sm"
            >
              Profilga qaytish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
