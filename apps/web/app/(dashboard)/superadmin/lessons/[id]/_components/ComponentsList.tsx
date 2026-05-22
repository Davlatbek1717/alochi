'use client';
import { useMemo, useState } from 'react';
import {
  Pencil,
  Plus,
  Trash2,
  Copy,
  Search,
  X,
  type LucideIcon,
  CheckSquare,
  ArrowDownNarrowWide,
  Volume2,
  Headphones,
  Pencil as PencilIcon,
  Image as ImageIcon,
  ListOrdered,
  Languages,
  Mic,
  MessageCircle,
  PuzzleIcon,
  Type,
  AudioLines,
} from 'lucide-react';

/**
 * Pass 5 — Components list (read-only render of `lesson.components_data`).
 *
 * Each row shows a colored type badge, a short summary of the config (the
 * configurator forms are responsible for full editing), and inline Edit /
 * Delete buttons. The "+ Topshiriq qo'shish" CTA opens the type picker.
 *
 * Component summaries are kept brief on purpose — they're meant as a quick
 * "what's in this lesson" overview, not a config preview. The author can
 * tap Edit to see the full form.
 */

export type ConfigComponent = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export const COMPONENT_LABELS: Record<string, string> = {
  mcq: "Ko'p tanlovli test",
  word_order: "So'z tartibi",
  vocabulary: "Lug'at audio",
  translate: 'Tarjima yozish',
  listen_pick: 'Eshitib tanlash',
  listen_type: 'Eshitib yozish',
  match_pairs: 'Juftliklarni topish',
  pick_picture: 'Rasmni tanlash',
  fill_blank: "Bo'sh joyni to'ldirish",
  spelling: "So'zni terish",
  order_sentences: 'Jumlalarni tartiblash',
  speak_sentence: 'Jumlani aytish',
  speak_words: "So'zlarni navbat bilan aytish",
};

export const COMPONENT_BADGE_STYLES: Record<string, string> = {
  mcq: 'bg-blue-50 text-blue-700 border-blue-100',
  word_order: 'bg-violet-50 text-violet-700 border-violet-100',
  vocabulary: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  translate: 'bg-amber-50 text-amber-700 border-amber-100',
  listen_pick: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  listen_type: 'bg-sky-50 text-sky-700 border-sky-100',
  match_pairs: 'bg-pink-50 text-pink-700 border-pink-100',
  pick_picture: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  fill_blank: 'bg-orange-50 text-orange-700 border-orange-100',
  spelling: 'bg-lime-50 text-lime-700 border-lime-100',
  order_sentences: 'bg-rose-50 text-rose-700 border-rose-100',
  speak_sentence: 'bg-teal-50 text-teal-700 border-teal-100',
  speak_words: 'bg-indigo-50 text-indigo-700 border-indigo-100',
};

/**
 * Per-type icon used in the component card. Helps the admin scan a
 * lesson's flow visually: the icon answers "what does the student see"
 * faster than the textual label.
 */
export const COMPONENT_ICONS: Record<string, LucideIcon> = {
  mcq: CheckSquare,
  word_order: ArrowDownNarrowWide,
  vocabulary: Volume2,
  translate: Languages,
  listen_pick: Headphones,
  listen_type: PencilIcon,
  match_pairs: PuzzleIcon,
  pick_picture: ImageIcon,
  fill_blank: Type,
  spelling: AudioLines,
  order_sentences: ListOrdered,
  speak_sentence: Mic,
  speak_words: MessageCircle,
};

/**
 * Build a concise human summary of a component's config. Each type pulls
 * 1-2 of the most identifying fields. Falls back to "Sozlanmagan" when the
 * config is empty (e.g. placeholder added but never edited).
 */
export function summarizeConfig(comp: ConfigComponent): string {
  const cfg = comp.config ?? {};
  switch (comp.type) {
    case 'mcq': {
      const q = (cfg as { question?: string; questions?: { text: string }[] }).question
        ?? (cfg as { questions?: { text: string }[] }).questions?.[0]?.text;
      return q ? `"${truncate(q, 50)}"` : 'Sozlanmagan';
    }
    case 'word_order': {
      const correct = (cfg as { correct?: string; sentences?: { correct: string }[] }).correct
        ?? (cfg as { sentences?: { correct: string }[] }).sentences?.[0]?.correct;
      return correct ? `"${truncate(correct, 50)}"` : 'Sozlanmagan';
    }
    case 'vocabulary': {
      const items = (cfg as { items?: unknown[] }).items;
      return Array.isArray(items) ? `${items.length} ta so'z` : 'Sozlanmagan';
    }
    case 'translate': {
      const src = (cfg as { sourceText?: string }).sourceText;
      return src ? `"${truncate(src, 40)}"` : 'Sozlanmagan';
    }
    case 'listen_pick':
    case 'listen_type': {
      const text = (cfg as { text?: string }).text;
      return text ? `"${truncate(text, 40)}"` : 'Sozlanmagan';
    }
    case 'match_pairs': {
      const pairs = (cfg as { pairs?: unknown[] }).pairs;
      return Array.isArray(pairs) ? `${pairs.length} ta juftlik` : 'Sozlanmagan';
    }
    case 'pick_picture':
    case 'spelling': {
      const word = (cfg as { word?: string }).word;
      return word ? `"${word}"` : 'Sozlanmagan';
    }
    case 'fill_blank': {
      const sent = (cfg as { sentence?: string }).sentence;
      return sent ? `"${truncate(sent, 40)}"` : 'Sozlanmagan';
    }
    case 'order_sentences': {
      const arr = (cfg as { sentences?: unknown[] }).sentences;
      return Array.isArray(arr) ? `${arr.length} ta jumla` : 'Sozlanmagan';
    }
    case 'speak_sentence': {
      const sent = (cfg as { sentence?: string }).sentence;
      return sent ? `"${truncate(sent, 40)}"` : 'Sozlanmagan';
    }
    case 'speak_words': {
      const txt = (cfg as { text?: string }).text;
      if (!txt) return 'Sozlanmagan';
      const wordCount = txt.trim().split(/\s+/).filter(Boolean).length;
      return `${wordCount} ta so'z — "${truncate(txt, 30)}"`;
    }
    default:
      return 'Sozlanmagan';
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

interface Props {
  components: ConfigComponent[];
  onAdd: () => void;
  onEdit: (comp: ConfigComponent) => void;
  onDelete: (comp: ConfigComponent) => void;
  /** Optional: when provided, each row gets a Duplicate button that calls
   *  this with the source component. The parent posts a new component
   *  with the same config and refreshes the list. */
  onDuplicate?: (comp: ConfigComponent) => void;
  isDeleting?: string | null;
  isDuplicating?: string | null;
}

export function ComponentsList({
  components,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: Props) {
  // Filter by type (chip group at top) + text search inside the summary.
  // Both narrow the rendered list; the count badge stays accurate.
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Count components per type so filter chips can show "MCQ (12)" badges
  // and admins know what's worth filtering for.
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of components) counts[c.type] = (counts[c.type] ?? 0) + 1;
    return counts;
  }, [components]);

  // Types present in this lesson, ordered by frequency desc — surfaces the
  // most-used type as the first chip after "All".
  const presentTypes = useMemo(
    () =>
      Object.keys(typeCounts).sort(
        (a, b) => typeCounts[b] - typeCounts[a],
      ),
    [typeCounts],
  );

  const filtered = useMemo(() => {
    let list = components;
    if (typeFilter !== 'all') {
      list = list.filter((c) => c.type === typeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const label = (COMPONENT_LABELS[c.type] ?? c.type).toLowerCase();
        const summary = summarizeConfig(c).toLowerCase();
        return label.includes(q) || summary.includes(q);
      });
    }
    return list;
  }, [components, typeFilter, search]);

  return (
    <div className="space-y-3">
      {components.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full border-2 border-dashed border-[#ede9e1] rounded-2xl py-10 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-white transition-all flex flex-col items-center justify-center gap-2"
        >
          <div className="w-12 h-12 rounded-full bg-[#f7f4ef] flex items-center justify-center">
            <Plus size={20} />
          </div>
          <p className="text-sm font-bold">Birinchi topshiriqni qo&apos;shing</p>
          <p className="text-xs text-[#64748b] font-semibold">
            13 turdagi mashq mavjud
          </p>
        </button>
      ) : (
        <>
          {/* Filter + search — only render when worth it (>= 5 items). On
              short lessons the chip row is more clutter than help. */}
          {components.length >= 5 && (
            <div className="space-y-2">
              {/* Search input */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
                  aria-hidden
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Topshiriqlar boʻyicha qidirish"
                  placeholder="Topshiriq matni boʻyicha qidiring..."
                  className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] placeholder:text-[#94a3b8]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Qidiruvni tozalash"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md hover:bg-[#f7f4ef] flex items-center justify-center text-[#94a3b8]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Type chips — All + every type present in this lesson */}
              <div className="flex flex-wrap gap-1.5">
                <TypeChip
                  active={typeFilter === 'all'}
                  onClick={() => setTypeFilter('all')}
                  label={`Hammasi · ${components.length}`}
                />
                {presentTypes.map((t) => (
                  <TypeChip
                    key={t}
                    active={typeFilter === t}
                    onClick={() => setTypeFilter(t)}
                    label={`${COMPONENT_LABELS[t] ?? t} · ${typeCounts[t]}`}
                  />
                ))}
              </div>

              {/* Live count when filters narrow the list */}
              {filtered.length !== components.length && (
                <p className="text-[11px] font-bold text-[#64748b]">
                  {filtered.length} / {components.length} ta topshiriq
                </p>
              )}
            </div>
          )}

          {filtered.length === 0 && components.length > 0 ? (
            <div className="border-2 border-dashed border-[#ede9e1] rounded-2xl py-8 text-center">
              <p className="text-sm font-bold text-[#64748b]">
                Hech narsa topilmadi
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                }}
                className="text-xs font-bold text-[#0d9488] hover:underline mt-1"
              >
                Filtrlarni tozalash
              </button>
            </div>
          ) : (
          <ul className="space-y-2">
            {filtered.map((comp) => {
              // Display # by position in the FULL list so the student-facing
              // order is honest even when filters are applied.
              const idx = components.indexOf(comp);
              const label = COMPONENT_LABELS[comp.type] ?? comp.type;
              const badgeClass =
                COMPONENT_BADGE_STYLES[comp.type] ??
                'bg-slate-50 text-slate-700 border-slate-200';
              const Icon = COMPONENT_ICONS[comp.type];
              const summary = summarizeConfig(comp);
              return (
                <li
                  key={comp.id}
                  className="group bg-white rounded-2xl border-[1.5px] border-[#ede9e1] hover:border-[#0d9488]/40 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="p-3 flex items-start gap-3">
                    {/* Order badge — student sees these in this order */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                        #{idx + 1}
                      </span>
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center ${badgeClass}`}
                      >
                        {Icon ? <Icon size={16} /> : null}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeClass}`}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="text-sm text-[#0f172a] font-semibold mt-1 line-clamp-2">
                        {summary}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEdit(comp)}
                        aria-label={`${label} tahrirlash`}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a] bg-[#f7f4ef] hover:bg-[#ede9e1] border border-[#ede9e1] px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Pencil size={12} /> Tahrir
                      </button>
                      {onDuplicate && (
                        <button
                          type="button"
                          onClick={() => onDuplicate(comp)}
                          disabled={isDuplicating === comp.id}
                          aria-label={`${label} dublikat`}
                          title="Nusxa olish"
                          className="p-2 rounded-lg text-[#0d9488] hover:bg-[#0d9488]/10 transition-colors disabled:opacity-50"
                        >
                          <Copy size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(comp)}
                        disabled={isDeleting === comp.id}
                        aria-label={`${label} o'chirish`}
                        className="p-2 rounded-lg text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          )}

          {/* Add-another CTA at the bottom — feels natural after scrolling
              through the list, and stays out of the way when empty. */}
          <button
            type="button"
            onClick={onAdd}
            className="w-full border-2 border-dashed border-[#ede9e1] rounded-2xl py-3.5 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] hover:bg-white text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Yana topshiriq qo&apos;shish
          </button>
        </>
      )}
    </div>
  );
}

export default ComponentsList;

/**
 * Compact pill used for the type-filter row above the component list.
 * Mirrors the FilterChip pattern from /superadmin/users so the visual
 * language stays consistent across the panel.
 */
function TypeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors border',
        active
          ? 'bg-[#0d9488] text-white border-[#0d9488]'
          : 'bg-white text-[#0f172a] border-[#ede9e1] hover:border-[#0d9488]/40 hover:bg-[#0d9488]/5',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
