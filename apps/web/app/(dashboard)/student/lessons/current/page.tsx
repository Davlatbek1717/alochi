'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, BookOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot } from '@/components/ui';

type NextLesson = { id: string; title: string } | null;

export default function CurrentLessonPage() {
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<NextLesson>('/lessons/next', {}, token)
      .then((res) => {
        if (res.data) {
          router.replace(`/student/lessons/${res.data.id}`);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [router]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center p-6">
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
            className="w-full inline-flex items-center justify-center gap-2 bg-[#58cc02] hover:brightness-105 text-white font-extrabold uppercase tracking-wide py-3 rounded-2xl border-b-[4px] border-[#46a302] active:translate-y-[2px] active:border-b-[2px]"
          >
            <BookOpen size={16} /> Darslar roʻyxati
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffaf0] flex items-center justify-center p-6">
      <div
        className="flex flex-col items-center gap-3 motion-safe:[animation:count-up-fade_500ms_ease-out]"
        role="status"
        aria-live="polite"
      >
        <Mascot expression="idle" size={120} />
        <p className="text-[#0f172a] font-extrabold text-base">Yuklanmoqda...</p>
        <p className="text-[#64748b] text-sm">Keyingi darsingiz tayyorlanyapti</p>
      </div>
    </div>
  );
}
