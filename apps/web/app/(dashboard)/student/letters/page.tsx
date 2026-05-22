'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal } from '@/components/ui';
import { formatDateLong } from '@/lib/date-uz';
import { Ustoz } from '@/components/Ustoz';

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

  const counts = useMemo(
    () => ({
      all: letters.length,
      owned: letters.filter((l) => l.owned).length,
      locked: letters.filter((l) => !l.owned).length,
      legendary: letters.filter((l) => l.rarity === 'legendary').length,
      rare: letters.filter((l) => l.rarity === 'rare').length,
    }),
    [letters],
  );

  const visible = useMemo(() => {
    if (filter === 'owned') return letters.filter((l) => l.owned);
    if (filter === 'locked') return letters.filter((l) => !l.owned);
    if (filter === 'legendary') return letters.filter((l) => l.rarity === 'legendary');
    if (filter === 'rare') return letters.filter((l) => l.rarity === 'rare');
    return letters;
  }, [letters, filter]);

  return (
    <div className="sp-theme min-h-full pb-24">
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          borderBottom: '1.5px solid var(--line)',
        }}
      >
        <div className="max-w-lg mx-auto md:max-w-3xl px-4 pt-3 pb-2.5 flex items-center gap-3">
          <Link
            href="/student"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="sp-eyebrow">yig‘ib bor</div>
            <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
              Harflar kolleksiyasi
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-3xl px-4 pt-4 space-y-4">
        {/* Banner */}
        <div
          className="flex items-center gap-4 p-4"
          style={{
            background: 'var(--ember-tint)',
            border: '2px solid var(--ember-deep)',
            borderRadius: 'var(--r-3)',
            boxShadow: '0 4px 0 var(--ember-deep)',
          }}
        >
          <Ustoz size={70} mood="cheer" className="sp-anim-float shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="sp-display text-lg" style={{ color: 'var(--ember-deep)' }}>
              {owned} / {total}
            </div>
            <div className="text-xs" style={{ color: 'var(--ink-2)' }}>
              {isComplete
                ? "To‘liq kolleksiya! 🎉 Hamma harf yutib olindi."
                : 'Hammasini yig‘ib so‘zni tuzasan!'}
            </div>
            <div
              className="mt-2 h-2 overflow-hidden"
              style={{ background: 'var(--paper-3)', borderRadius: 999 }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'var(--ember)', borderRadius: 999 }}
              />
            </div>
          </div>
        </div>

        {/* Filter chips */}
        {letters.length > 0 && (
          <div className="overflow-x-auto -mx-4 px-4 sp-theme">
            <div className="flex gap-2 w-max">
              {FILTERS.map((f) => {
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className="sp-mono shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                    style={{
                      background: isActive ? 'var(--ink)' : 'var(--bone-2)',
                      color: isActive ? 'var(--bone)' : 'var(--ink-3)',
                      border: `1px solid ${isActive ? 'var(--ink)' : 'var(--line)'}`,
                      borderRadius: 999,
                    }}
                  >
                    {f.label}
                    <span style={{ opacity: 0.7 }}>{counts[f.key]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="sp-skeleton aspect-square w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              background: 'var(--bone)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--r-4)',
            }}
          >
            <Ustoz size={110} mood="calm" className="mx-auto" />
            <p className="sp-display mt-3" style={{ color: 'var(--ink)' }}>
              {letters.length === 0 ? "Kolleksiya bo‘sh" : 'Bu filtrda harf yo‘q'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-3)' }}>
              {letters.length === 0
                ? 'Birinchi darsingizni tugating va harf yutib oling.'
                : 'Boshqa filtrni tanlang.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
            {visible.map((letter) => {
              const got = letter.owned;
              const display =
                letter.char.length > 2 ? letter.char.slice(0, 2) : letter.char;
              return (
                <button
                  key={letter.id}
                  type="button"
                  onClick={() => setSelected(letter)}
                  title={got ? letter.char : 'Yopiq'}
                  className="relative aspect-square flex items-center justify-center sp-display active:translate-y-[1px] transition-transform"
                  style={{
                    background: got ? 'var(--gold)' : 'var(--paper-2)',
                    border: `2px solid ${got ? 'var(--gold-deep)' : 'var(--line)'}`,
                    boxShadow: got ? '0 3px 0 var(--gold-deep)' : 'none',
                    borderRadius: 'var(--r-2)',
                    color: got ? 'var(--ink)' : 'var(--ink-4)',
                    fontSize: 22,
                    fontWeight: 800,
                    opacity: got ? 1 : 0.55,
                  }}
                >
                  {got ? display : '?'}
                  {got && (
                    <span
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: 'var(--leaf)',
                        color: 'var(--bone)',
                        fontSize: 9,
                        border: '1.5px solid var(--bone-2)',
                      }}
                    >
                      ✓
                    </span>
                  )}
                  {!got && (
                    <Lock
                      size={12}
                      className="absolute bottom-1 right-1"
                      style={{ color: 'var(--ink-4)' }}
                    />
                  )}
                </button>
              );
            })}
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

function LetterDetail({ letter }: { letter: LetterItem }) {
  if (!letter.owned) {
    return (
      <div className="space-y-3">
        <div
          className="py-8 flex items-center justify-center"
          style={{ background: 'var(--paper-2)', borderRadius: 'var(--r-3)' }}
        >
          <Lock size={36} style={{ color: 'var(--ink-4)' }} />
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
          Bu harfni qaysi darsda olishingiz mumkin:
        </p>
        <p className="text-sm sp-display" style={{ color: 'var(--sky)' }}>
          {letter.nextLessonHint ?? 'Yangi darslarni oching'}
        </p>
      </div>
    );
  }

  const tgShare = BOT_USERNAME
    ? `https://t.me/share/url?url=${encodeURIComponent(
        `https://t.me/${BOT_USERNAME}`,
      )}&text=${encodeURIComponent(
        `Men "${letter.char}" harfini A'lojon'da yutib oldim! 🎉`,
      )}`
    : '';

  return (
    <div className="space-y-3">
      <div
        className="py-8 flex items-center justify-center"
        style={{
          background: 'var(--gold-tint)',
          border: '1.5px solid var(--gold-soft)',
          borderRadius: 'var(--r-3)',
        }}
      >
        <span className="sp-display" style={{ color: 'var(--gold-deep)', fontSize: 56, fontWeight: 800 }}>
          {letter.char}
        </span>
      </div>
      <div>
        <p className="sp-eyebrow">Manba</p>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ink)' }}>
          {letter.sourceLesson?.title ?? 'Maxsus dars'}
        </p>
      </div>
      {letter.earnedAt && (
        <div>
          <p className="sp-eyebrow">Olingan</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink)' }}>
            {formatDateLong(letter.earnedAt)}
          </p>
        </div>
      )}
      {tgShare && (
        <a
          href={tgShare}
          target="_blank"
          rel="noopener noreferrer"
          className="sp-display w-full flex items-center justify-center gap-2 py-2.5 active:translate-y-[1px] transition-transform"
          style={{
            background: 'var(--sky)',
            color: 'var(--bone)',
            border: '2px solid #2D5872',
            borderRadius: 'var(--r-2)',
            boxShadow: '0 3px 0 #2D5872',
            fontWeight: 700,
          }}
        >
          <Send size={14} /> Telegram’da ulashish
        </a>
      )}
    </div>
  );
}
