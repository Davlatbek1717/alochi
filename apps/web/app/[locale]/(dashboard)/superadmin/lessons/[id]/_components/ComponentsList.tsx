'use client';
import {
  Pencil,
  Plus,
  Trash2,
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
  isDeleting?: string | null;
}

export function ComponentsList({
  components,
  onAdd,
  onEdit,
  onDelete,
  isDeleting,
}: Props) {
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
          <ul className="space-y-2">
            {components.map((comp, idx) => {
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
