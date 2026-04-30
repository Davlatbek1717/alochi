/**
 * Canonical status colour vocabulary.
 *
 * Single source of truth: Uzbek (`yashil` / `sariq` / `qizil`) is the
 * canonical form used everywhere internally — DTOs, service layer, DB
 * columns, event payloads, cron jobs.
 *
 * English (`green` / `yellow` / `red`) appears ONLY at external
 * boundaries (the WebSocket gateway forwarding to web clients that prefer
 * English keys, Telegram emoji renderers). Use {@link toEnglish} /
 * {@link toUz} translators at those boundaries instead of sprinkling
 * raw English literals through the codebase.
 */

export type StatusColor = 'yashil' | 'sariq' | 'qizil';

export type StatusColorEn = 'green' | 'yellow' | 'red';

/** Order from worst to best — higher number = more severe. */
export const STATUS_RANK: Record<StatusColor, number> = {
  qizil: 3,
  sariq: 2,
  yashil: 1,
};

export const STATUS_LABELS_EN: Record<StatusColor, StatusColorEn> = {
  yashil: 'green',
  sariq: 'yellow',
  qizil: 'red',
};

const EN_TO_UZ: Record<StatusColorEn, StatusColor> = {
  green: 'yashil',
  yellow: 'sariq',
  red: 'qizil',
};

export const STATUS_EMOJI: Record<StatusColor, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
};

export const STATUS_LABELS_UZ_HUMAN: Record<StatusColor, string> = {
  yashil: '🟢 Yashil',
  sariq: '🟡 Sariq',
  qizil: '🔴 Qizil',
};

/** Translate Uzbek canonical → English (boundary use only). */
export function toEnglish(c: StatusColor): StatusColorEn {
  return STATUS_LABELS_EN[c];
}

/** Translate English (external input) → Uzbek canonical. */
export function toUz(c: StatusColorEn): StatusColor {
  return EN_TO_UZ[c];
}

export function isStatusColor(v: unknown): v is StatusColor {
  return v === 'yashil' || v === 'sariq' || v === 'qizil';
}

/**
 * Pick the most severe (worst) colour from a list. Nulls / unknowns are
 * ignored. Returns null when no recognised colour is present.
 */
export function worstStatusColor(
  values: (string | null | undefined)[],
): StatusColor | null {
  let best: StatusColor | null = null;
  let bestRank = 0;
  for (const v of values) {
    if (!isStatusColor(v)) continue;
    const rank = STATUS_RANK[v];
    if (rank > bestRank) {
      bestRank = rank;
      best = v;
    }
  }
  return best;
}

/** Render `🟢` / `🟡` / `🔴` for a (possibly null/unknown) value. */
export function statusEmoji(value: string | null | undefined): string {
  if (!isStatusColor(value)) return '⚪';
  return STATUS_EMOJI[value];
}
