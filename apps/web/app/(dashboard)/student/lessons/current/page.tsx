'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <div className="max-w-lg mx-auto py-20 text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-bold text-gray-800">Barcha darslar tugallandi!</h2>
        <p className="text-gray-500 mt-2">Ajoyib — siz barcha mavjud darslarni o&apos;tdingiz.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-20 flex justify-center">
      <p className="text-gray-500">Dars qidirilmoqda...</p>
    </div>
  );
}
