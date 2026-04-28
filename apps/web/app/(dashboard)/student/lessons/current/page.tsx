'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { apiRequest } from '@/lib/api';

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
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[24px] border-[1.5px] border-[#ede9e1] p-10 text-center max-w-sm w-full space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto">
            <Trophy size={36} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-[#0f172a]">Barcha darslar tugallandi!</p>
            <p className="text-[#64748b] text-sm mt-2 leading-relaxed">
              Ajoyib — siz barcha mavjud darslarni o&apos;tdingiz.
            </p>
          </div>
          <button
            onClick={() => router.push('/student/lessons')}
            className="w-full bg-[#0f172a] text-white py-3.5 rounded-xl font-bold text-sm"
          >
            Darslar ro&apos;yxati
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
      <div className="w-7 h-7 border-[3px] border-[#0f172a]/20 border-t-[#0f172a] rounded-full animate-spin" />
    </div>
  );
}
