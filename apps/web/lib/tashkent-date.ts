'use client';
/** Today's date YYYY-MM-DD in Asia/Tashkent (UTC+5). Safe to call SSR — falls back to UTC. */
export function tashkentToday(): string {
  if (typeof window === 'undefined') return new Date().toISOString().split('T')[0];
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
}
