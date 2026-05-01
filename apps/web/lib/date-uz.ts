// Stable Uzbek date formatter — avoids SSR/CSR Intl drift.
// Some Node.js builds ship without full ICU data, causing locale renders to
// differ between server and client (hydration mismatch). This module formats
// dates with hardcoded Uzbek strings so output is identical everywhere.

const MONTHS_LONG = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr',
];

const MONTHS_SHORT = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avg', 'sen', 'okt', 'noy', 'dek',
];

const WEEKDAYS_LONG = [
  'yakshanba', 'dushanba', 'seshanba', 'chorshanba',
  'payshanba', 'juma', 'shanba',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "1-may, 2026" */
export function formatDateLong(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getDate()}-${MONTHS_LONG[d.getMonth()]}, ${d.getFullYear()}`;
}

/** "1 may 2026" */
export function formatDateShort(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "01.05.2026" */
export function formatDateNumeric(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "1-may, juma" */
export function formatDateWeekday(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getDate()}-${MONTHS_LONG[d.getMonth()]}, ${WEEKDAYS_LONG[d.getDay()]}`;
}

/** "14:32" */
export function formatTime(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "1 may, 14:32" */
export function formatDateTime(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "1-may, 2026 — 14:32" */
export function formatDateTimeLong(input: Date | string | number | null | undefined): string {
  const d = toDate(input);
  if (!d) return '';
  return `${formatDateLong(d)} — ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "1 234 567" — stable thousands separator (space) for SSR/CSR parity. */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(n));
  const str = String(abs);
  // Insert thin space every 3 digits from right
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 === 0) out += ' ';
    out += str[i];
  }
  return sign + out;
}
