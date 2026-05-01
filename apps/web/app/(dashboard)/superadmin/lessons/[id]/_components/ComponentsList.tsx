'use client';
import { Pencil, Plus, Trash2 } from 'lucide-react';

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
      <button
        type="button"
        onClick={onAdd}
        className="w-full border-2 border-dashed border-[#ede9e1] rounded-[18px] py-4 text-[#0f172a] hover:border-[#0d9488] hover:text-[#0d9488] text-sm font-bold transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={16} /> Topshiriq qo&apos;shish
      </button>

      {components.length === 0 ? (
        <div className="bg-white rounded-[18px] border-[1.5px] border-dashed border-[#ede9e1] p-6 text-center">
          <p className="text-[#64748b] text-sm font-semibold">
            Hali topshiriq yo&apos;q. Yuqoridagi tugmadan qo&apos;shing.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {components.map((comp) => {
            const label = COMPONENT_LABELS[comp.type] ?? comp.type;
            const badgeClass =
              COMPONENT_BADGE_STYLES[comp.type] ??
              'bg-slate-50 text-slate-700 border-slate-200';
            const summary = summarizeConfig(comp);
            return (
              <li
                key={comp.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-3 flex items-center gap-3"
              >
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${badgeClass}`}
                >
                  {label}
                </span>
                <span className="text-sm text-[#0f172a] font-semibold flex-1 min-w-0 truncate">
                  {summary}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEdit(comp)}
                    aria-label={`${label} tahrirlash`}
                    className="p-2 rounded-lg text-[#0f172a] hover:bg-[#f7f4ef] transition-colors"
                  >
                    <Pencil size={14} />
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ComponentsList;
