'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, BookOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';

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
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={<BookOpen size={16} />}
            className="!bg-[#0f172a] hover:!bg-[#1e293b] !border-[#0f172a] !rounded-xl"
            onClick={() => router.push('/student/lessons')}
          >
            Darslar ro&apos;yxati
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <Skeleton theme="light" className="w-16 h-16 rounded-2xl" />
        <div className="space-y-2 w-48">
          <Skeleton theme="light" className="h-4 w-full" />
          <Skeleton theme="light" className="h-3 w-3/4 mx-auto" />
        </div>
      </div>
    </div>
  );
}
