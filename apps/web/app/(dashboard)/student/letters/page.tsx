'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Send, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Modal, Skeleton } from '@/components/ui';
import { formatDateLong } from '@/lib/date-uz';

interface LetterItem {
  id: string;
  char: string;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'legendary' | string;
  owned: boolean;
  earnedAt: string | null;
  /** Optional hint about which lesson unlocks this letter (server-provided). */
  nextLessonHint?: string | null;
  sourceLesson?: { id: string; title?: string } | null;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

export default function StudentLettersPage() {
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LetterItem | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LetterItem[]>('/letters/mine', {}, token)
      .then((r) => setLetters(r.data ?? []))
      .catch(() => setLetters([]))
      .finally(() => setLoading(false));
  }, []);

  const owned = useMemo(() => letters.filter((l) => l.owned).length, [letters]);
  const total = letters.length || 36;
  const pct = total ? Math.round((owned / total) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-full bg-[#fffaf0]">
        <header className="bg-white border-b-[1.5px] border-[#ede9e1] px-4 py-3">
          <Skeleton theme="light" className="h-6 w-40 mb-2" />
          <Skeleton theme="light" className="h-3 w-32" />
        </header>
        <div className="max-w-lg mx-auto p-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 36 }).map((_, i) => (
            <Skeleton
              key={i}
              theme="light"
              className="aspect-square w-full rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#fffaf0]">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="text-[#64748b] hover:text-[#0f172a]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1">
            <h1 className="text-[#0f172a] font-extrabold text-lg leading-tight">
              Kolleksiya
            </h1>
            <p className="text-xs text-[#64748b]">
              {owned} / {total} ta harf
            </p>
          </div>
          <Sparkles size={18} className="text-[#fbbf24]" />
        </div>
        {/* Progress bar */}
        <div className="max-w-lg mx-auto mt-2 h-2 bg-white border border-[#ede9e1] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">
        {letters.length === 0 ? (
          <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center">
            <Mascot expression="idle" size={120} className="mx-auto" />
            <p className="text-[#0f172a] font-bold mt-3">Kolleksiya boʻsh</p>
            <p className="text-[#64748b] text-sm mt-1">
              Birinchi darsingizni tugating va harf yutib oling.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {letters.map((letter) => (
              <LetterCard
                key={letter.id}
                letter={letter}
                onClick={() => setSelected(letter)}
              />
            ))}
          </div>
        )}
      </main>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.owned ? `Harf: ${selected.char}` : 'Yopiq harf'}
        theme="light"
        size="sm"
      >
        {selected && <LetterDetail letter={selected} />}
      </Modal>
    </div>
  );
}

function LetterCard({
  letter,
  onClick,
}: {
  letter: LetterItem;
  onClick: () => void;
}) {
  const isLegendary = letter.owned && letter.rarity === 'legendary';
  const isRare = letter.owned && letter.rarity === 'rare';
  const display =
    letter.char.length > 2 ? letter.char.slice(0, 2) : letter.char;

  return (
    <button
      type="button"
      onClick={onClick}
      title={letter.owned ? letter.char : 'Yopiq'}
      className={`relative aspect-square rounded-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 motion-safe:[animation:count-up-fade_400ms_ease-out] ${
        letter.owned
          ? isLegendary
            ? 'bg-gradient-to-br from-[#fffbeb] via-[#fde68a] to-[#fbbf24] border-[2px] border-[#fbbf24] shadow-md'
            : isRare
              ? 'bg-gradient-to-br from-[#ede9fe] to-[#c4b5fd] border-[2px] border-[#a78bfa] shadow-sm'
              : 'bg-white border-[1.5px] border-[#ede9e1] shadow-sm'
          : 'bg-[#1f2937] border-[1.5px] border-[#0f172a] opacity-90'
      }`}
    >
      {/* Sparkle particles for legendary owned */}
      {isLegendary && (
        <>
          <span
            aria-hidden
            className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-white motion-safe:[animation:pop_1.4s_ease-in-out_infinite]"
          />
          <span
            aria-hidden
            className="absolute bottom-1.5 right-1.5 w-1 h-1 rounded-full bg-white motion-safe:[animation:pop_1.6s_ease-in-out_infinite]"
            style={{ animationDelay: '0.3s' }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 right-1 w-1 h-1 rounded-full bg-white motion-safe:[animation:pop_1.8s_ease-in-out_infinite]"
            style={{ animationDelay: '0.6s' }}
          />
        </>
      )}
      {letter.owned ? (
        <span
          className={`font-extrabold text-2xl ${
            isLegendary
              ? 'text-[#92400e]'
              : isRare
                ? 'text-[#5b21b6]'
                : 'text-[#0f172a]'
          }`}
        >
          {display}
        </span>
      ) : (
        <>
          <span className="absolute inset-0 flex items-center justify-center text-[#475569] font-extrabold text-xl select-none">
            ?
          </span>
          <Lock size={12} className="absolute bottom-1 right-1 text-[#94a3b8]" />
        </>
      )}
    </button>
  );
}

function LetterDetail({ letter }: { letter: LetterItem }) {
  if (!letter.owned) {
    return (
      <div className="space-y-3">
        <div className="bg-[#1f2937] rounded-2xl py-8 flex items-center justify-center">
          <Lock size={36} className="text-[#94a3b8]" />
        </div>
        <p className="text-sm text-[#0f172a] leading-relaxed">
          Bu harfni qaysi darsda olishingiz mumkin:
        </p>
        <p className="text-sm font-bold text-[#1cb0f6]">
          {letter.nextLessonHint ?? 'Yangi darslarni oching'}
        </p>
      </div>
    );
  }

  const tgShare = BOT_USERNAME
    ? `https://t.me/share/url?url=${encodeURIComponent(
        `https://t.me/${BOT_USERNAME}`,
      )}&text=${encodeURIComponent(
        `Men "${letter.char}" harfini A'lochi'da yutib oldim! 🎉`,
      )}`
    : '';

  const isLegendary = letter.rarity === 'legendary';

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl py-8 flex items-center justify-center ${
          isLegendary
            ? 'bg-gradient-to-br from-[#fffbeb] via-[#fde68a] to-[#fbbf24]'
            : letter.rarity === 'rare'
              ? 'bg-gradient-to-br from-[#ede9fe] to-[#c4b5fd]'
              : 'bg-[#fffaf0] border border-[#ede9e1]'
        }`}
      >
        <span
          className={`font-extrabold text-6xl ${
            isLegendary
              ? 'text-[#92400e]'
              : letter.rarity === 'rare'
                ? 'text-[#5b21b6]'
                : 'text-[#0f172a]'
          }`}
        >
          {letter.char}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-[#94a3b8] uppercase tracking-wider font-bold">
          Manba
        </p>
        <p className="text-sm text-[#0f172a]">
          {letter.sourceLesson?.title ?? 'Maxsus dars'}
        </p>
      </div>
      {letter.earnedAt && (
        <div className="space-y-1">
          <p className="text-xs text-[#94a3b8] uppercase tracking-wider font-bold">
            Olingan
          </p>
          <p className="text-sm text-[#0f172a]">
            {formatDateLong(letter.earnedAt)}
          </p>
        </div>
      )}
      {tgShare && (
        <a
          href={tgShare}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-2 bg-[#1cb0f6] hover:brightness-105 text-white font-extrabold text-sm py-2.5 rounded-xl border-b-[3px] border-[#0a7ea8] active:translate-y-[1px] active:border-b-[1px]"
        >
          <Send size={14} /> Telegram&apos;da ulashish
        </a>
      )}
    </div>
  );
}
