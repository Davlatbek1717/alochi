'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, BookOpen, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot } from '@/components/ui';

type NextLesson = { id: string; title: string } | null;

export default function CurrentLessonPage() {
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [networkError, setNetworkError] = useState('');

  function fetchNext() {
    const token = localStorage.getItem('accessToken') ?? '';
    setNetworkError('');
    setNotFound(false);
    apiRequest<NextLesson>('/lessons/next', {}, token)
      .then((res) => {
        if (res.data) {
          router.replace(`/student/lessons/${res.data.id}`);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '';
        // 404 = no active lesson (all done); other errors = network / server
        if (msg.includes('404') || msg.toLowerCase().includes('topilmadi')) {
          setNotFound(true);
        } else {
          setNetworkError(msg || 'Dars yuklanmadi');
        }
      });
  }

  useEffect(() => {
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (networkError) {
    return (
      <div className="min-h-full bg-[#fffaf0] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border-[1.5px] border-rose-200 p-8 text-center max-w-sm w-full space-y-4">
          <Mascot expression="sad" size={100} className="mx-auto" />
          <p className="text-[#0f172a] font-extrabold text-base">
            Dars yuklanmadi
          </p>
          <p className="text-[#64748b] text-sm">{networkError}</p>
          <p className="text-[#94a3b8] text-xs">Internet aloqasini tekshiring</p>
          <button
            type="button"
            onClick={fetchNext}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#58cc02] hover:brightness-105 text-white font-extrabold uppercase tracking-wide py-3 rounded-2xl border-b-[4px] border-[#46a302] active:translate-y-[2px] active:border-b-[2px] min-h-[44px]"
          >
            <RefreshCw size={16} /> Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-full bg-[#fffaf0] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-8 text-center max-w-sm w-full space-y-4 shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#d97706] border-[3px] border-[#fef3c7] flex items-center justify-center mx-auto shadow">
            <Trophy size={36} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-[#0f172a]">
              Barcha darslar tugallandi!
            </p>
            <p className="text-[#64748b] text-sm mt-2 leading-relaxed">
              Ajoyib — siz barcha mavjud darslarni o&apos;tdingiz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/student/lessons')}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#58cc02] hover:brightness-105 text-white font-extrabold uppercase tracking-wide py-3 rounded-2xl border-b-[4px] border-[#46a302] active:translate-y-[2px] active:border-b-[2px] min-h-[44px]"
          >
            <BookOpen size={16} /> Darslar ro&apos;yxati
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fffaf0] flex items-center justify-center p-6">
      <div
        className="flex flex-col items-center gap-3 motion-safe:[animation:count-up-fade_500ms_ease-out]"
        role="status"
        aria-live="polite"
      >
        <Mascot expression="idle" size={120} animated />
        <p className="text-[#0f172a] font-extrabold text-base">Yuklanmoqda...</p>
        <p className="text-[#64748b] text-sm">Keyingi darsingiz tayyorlanyapti</p>
      </div>
    </div>
  );
}
