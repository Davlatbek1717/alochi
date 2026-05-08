/**
 * Tashkent time helpers.
 *
 * Asia/Tashkent is UTC+5 with no DST. We rely on the Intl API (available on
 * Node 18+) rather than adding a date-fns-tz dependency.
 */

const TZ = 'Asia/Tashkent';

/** Returns the current Date object (UTC internally, but represents now). */
export function nowInTashkent(): Date {
  return new Date();
}

/**
 * Returns the hour and minute in Tashkent local time for a given UTC date.
 */
function tashkentHourMinute(date: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(
    parts.find((p) => p.type === 'minute')?.value ?? '0',
    10,
  );
  return { hour, minute };
}

/**
 * Returns 'morning' | 'evening' | null depending on whether now falls
 * inside a check-in window in Tashkent local time.
 *
 * Morning:  06:00 – 06:30 (inclusive of 06:00, exclusive of 06:31)
 * Evening:  18:00 – 22:00 (inclusive of 18:00, exclusive of 22:01)
 */
export function currentWindow(): 'morning' | 'evening' | null {
  const now = new Date();
  const { hour, minute } = tashkentHourMinute(now);
  const totalMinutes = hour * 60 + minute;

  // Morning: 06:00–06:30  →  360–390
  if (totalMinutes >= 360 && totalMinutes <= 390) return 'morning';
  // Evening: 18:00–22:00  →  1080–1320
  if (totalMinutes >= 1080 && totalMinutes <= 1320) return 'evening';

  return null;
}

/**
 * Returns the calendar date string (YYYY-MM-DD) in Tashkent timezone for
 * the given date (defaults to now).
 */
export function tashkentDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    // en-CA gives YYYY-MM-DD format
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Converts a YYYY-MM-DD string to a Date representing midnight UTC that
 * Prisma/PostgreSQL will store as the correct date.
 *
 * Because Prisma DateTime with @db.Date stores the date portion, we pass
 * a UTC midnight date and rely on the DB's date column (which ignores time).
 * The resulting ISO string YYYY-MM-DDT00:00:00.000Z maps to YYYY-MM-DD date.
 */
export function dateStringToDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Returns the descriptive name for the next check-in window in Uzbek.
 */
export function nextWindowLabel(current: 'morning' | 'evening' | null): string {
  if (current === 'morning') return 'kechki (18:00–22:00)';
  if (current === 'evening') return 'ertangi ertalabki (06:00–06:30)';
  // If outside windows, figure out which is next
  const now = new Date();
  const { hour, minute } = tashkentHourMinute(now);
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes < 360) return 'ertalabki (06:00–06:30)';
  if (totalMinutes < 1080) return 'kechki (18:00–22:00)';
  return 'ertangi ertalabki (06:00–06:30)';
}
