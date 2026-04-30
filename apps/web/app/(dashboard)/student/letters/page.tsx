'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';

interface LetterItem {
  id: string;
  char: string;
  imageUrl: string;
  rarity: string;
  owned: boolean;
  earnedAt: string | null;
}

const RARITY_BG: Record<string, string> = {
  common: 'bg-slate-50 border-slate-200',
  rare: 'bg-blue-50 border-blue-200',
  legendary: 'bg-amber-50 border-amber-200',
};

export default function StudentLettersPage() {
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LetterItem[]>('/letters/mine', {}, token)
      .then((r) => setLetters(r.data))
      .catch(() => setLetters([]))
      .finally(() => setLoading(false));
  }, []);

  const owned = letters.filter((l) => l.owned).length;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-3">
        <Skeleton theme="light" className="h-10 w-1/2" />
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 36 }).map((_, i) => (
            <Skeleton key={i} theme="light" className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <Link
        href="/student"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Orqaga
      </Link>

      <div>
        <h1 className="font-bold text-xl text-gray-800">Kolleksiya</h1>
        <p className="text-sm text-gray-500">
          {owned} / {letters.length} ta harf yig&apos;ildi
        </p>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {letters.map((letter) => (
          <div
            key={letter.id}
            className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
              letter.owned
                ? RARITY_BG[letter.rarity] ?? RARITY_BG.common
                : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
            title={letter.char}
          >
            {letter.owned ? (
              <span
                className={`font-bold text-lg ${
                  letter.rarity === 'legendary'
                    ? 'text-amber-700'
                    : letter.rarity === 'rare'
                    ? 'text-blue-700'
                    : 'text-slate-700'
                }`}
              >
                {letter.char.length > 2 ? letter.char.slice(0, 2) : letter.char}
              </span>
            ) : (
              <Lock size={14} className="text-gray-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
