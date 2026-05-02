'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Lock,
  Send,
  Sparkles,
  Trophy,
  Star,
} from 'lucide-react';
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
  nextLessonHint?: string | null;
  sourceLesson?: { id: string; title?: string } | null;
}

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT ?? '';

type Filter = 'all' | 'owned' | 'locked' | 'legendary' | 'rare';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'owned', label: 'Yutilgan' },
  { key: 'locked', label: 'Yopiq' },
  { key: 'legendary', label: 'Afsonaviy' },
  { key: 'rare', label: 'Kamyob' },
];

export default function StudentLettersPage() {
  const [letters, setLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LetterItem | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

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
  const isComplete = total > 0 && owned === total;

  const counts = useMemo(() => {
    return {
      all: letters.length,
      owned: letters.filter((l) => l.owned).length,
      locked: letters.filter((l) => !l.owned).length,
      legendary: letters.filter((l) => l.rarity === 'legendary').length,
      rare: letters.filter((l) => l.rarity === 'rare').length,
    };
  }, [letters]);

  const visible = useMemo(() => {
    if (filter === 'owned') return letters.filter((l) => l.owned);
    if (filter === 'locked') return letters.filter((l) => !l.owned);
    if (filter === 'legendary') return letters.filter((l) => l.rarity === 'legendary');
    if (filter === 'rare') return letters.filter((l) => l.rarity === 'rare');
    return letters;
  }, [letters, filter]);

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
    <div className="min-h-full bg-[#fffaf0] pb-28">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/95 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-full bg-white border border-[#ede9e1] flex items-center justify-center text-[#3c3c3c] hover:bg-[#f3eedf] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#0f172a] font-extrabold text-lg leading-tight flex items-center gap-2">
              <Sparkles size={16} className="text-[#fbbf24]" />
              Kolleksiya
            </h1>
            <p className="text-[11px] text-[#64748b] font-semibold">
              {owned} / {total} ta harf · {pct}%
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-lg mx-auto mt-2.5 h-2 bg-white border border-[#ede9e1] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#fbbf24] via-[#f59e0b] to-[#d97706] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-6 space-y-4">
        {/* Filter chips */}
        {letters.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-2 w-max">
              {FILTERS.map((f) => {
                const count = counts[f.key];
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                    }`}
                  >
                    {f.label}
                    <span
                      className={
                        isActive ? 'text-white/80' : 'text-[#94a3b8]'
                      }
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 100% celebration banner */}
        {isComplete && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fef3c7] via-[#fde68a] to-[#fbbf24] border-[1.5px] border-[#fbbf24] p-4 motion-safe:animate-[bounce-in_500ms_ease-out]">
            <div
              aria-hidden
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/30"
            />
            <div className="relative flex items-center gap-3">
              <Trophy size={28} className="text-[#92400e] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold text-[#92400e]">
                  To&apos;liq kolleksiya! 🎉
                </p>
                <p className="text-xs font-bold text-[#7c2d12]">
                  Hamma {total} ta harf yutib olindi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rarity legend — only when there are rare/legendary cards
            so beginners with only common letters aren't confused. */}
        {(counts.legendary > 0 || counts.rare > 0) && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3">
            <p className="text-[10px] font-extrabold text-[#0f172a] uppercase tracking-widest mb-2">
              Kamyob darajalari
            </p>
            <div className="flex items-center gap-3 flex-wrap text-xs font-bold">
              <RarityChip
                color="from-[#fffbeb] via-[#fde68a] to-[#fbbf24]"
                border="border-[#fbbf24]"
                text="text-[#92400e]"
                label="Afsonaviy"
                count={counts.legendary}
              />
              <RarityChip
                color="from-[#ede9fe] to-[#c4b5fd]"
                border="border-[#a78bfa]"
                text="text-[#5b21b6]"
                label="Kamyob"
                count={counts.rare}
              />
              <RarityChip
                color=""
                border="border-[#ede9e1]"
                text="text-[#64748b]"
                label="Oddiy"
                count={letters.length - counts.legendary - counts.rare}
              />
            </div>
          </div>
        )}

        {/* Card grid */}
        {visible.length === 0 ? (
          <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-8 text-center">
            <Mascot expression="idle" size={120} className="mx-auto" />
            <p className="text-[#0f172a] font-bold mt-3">
              {letters.length === 0
                ? "Kolleksiya bo'sh"
                : 'Bu filtrda harf yo‘q'}
            </p>
            <p className="text-[#64748b] text-sm mt-1">
              {letters.length === 0
                ? "Birinchi darsingizni tugating va harf yutib oling."
                : 'Boshqa filtrni tanlang.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {visible.map((letter) => (
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

function RarityChip({
  color,
  border,
  text,
  label,
  count,
}: {
  color: string;
  border: string;
  text: string;
  label: string;
  count: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${border} ${text} ${
        color ? `bg-gradient-to-br ${color}` : 'bg-white'
      }`}
    >
      <Star size={11} fill="currentColor" />
      {label}
      <span className="opacity-70">·</span>
      <span>{count}</span>
    </span>
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
  const rarityLabel =
    letter.rarity === 'legendary'
      ? 'Afsonaviy'
      : letter.rarity === 'rare'
        ? 'Kamyob'
        : 'Oddiy';

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl py-8 flex items-center justify-center relative overflow-hidden ${
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
        <span
          className={`absolute top-2 right-3 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isLegendary
              ? 'bg-[#92400e]/15 text-[#92400e]'
              : letter.rarity === 'rare'
                ? 'bg-[#5b21b6]/15 text-[#5b21b6]'
                : 'bg-[#94a3b8]/15 text-[#475569]'
          }`}
        >
          <Star size={10} fill="currentColor" />
          {rarityLabel}
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
