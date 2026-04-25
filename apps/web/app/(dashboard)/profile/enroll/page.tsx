'use client';
import { useState } from 'react';
import { EnrollmentCamera } from './_components/EnrollmentCamera';

export default function EnrollPage() {
  const [stage, setStage] = useState<'intro' | 'camera' | 'uploading' | 'done'>('intro');
  const [error, setError] = useState('');

  async function handleImages(images: string[]) {
    setStage('uploading');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/face/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ imagesBase64: images }),
      });
      if (!res.ok) throw new Error("Ro'yxatdan o'tkazib bo'lmadi");
      setStage('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      setStage('camera');
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4 py-6">
      <h1 className="text-xl font-bold">Yuz ID — Ro&apos;yxatga Olish</h1>

      {stage === 'intro' && (
        <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-700">
            Bu jarayon 1 daqiqa davom etadi. Kamera 5 ta turli burchakdan rasmingizni oladi.
          </p>
          <p className="text-xs text-gray-500">
            ✅ Faqat matematik vektorlar saqlanadi — asl rasmingiz saqlanmaydi (PDPL §533)
          </p>
          <button
            onClick={() => setStage('camera')}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            Boshlash
          </button>
        </div>
      )}

      {stage === 'camera' && (
        <>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <EnrollmentCamera onComplete={handleImages} />
        </>
      )}

      {stage === 'uploading' && (
        <div className="text-center py-12 text-gray-500">⏳ Yuklanmoqda...</div>
      )}

      {stage === 'done' && (
        <div className="text-center py-8 space-y-3">
          <div className="text-5xl">✅</div>
          <p className="font-bold text-lg">Muvaffaqiyatli saqlandi!</p>
          <p className="text-gray-500 text-sm">
            Ertadan boshlab filial kirishida avtomatik aniqlanasiz.
          </p>
          <a href="/profile" className="text-indigo-600 text-sm underline">
            Profilga qaytish
          </a>
        </div>
      )}
    </div>
  );
}
