'use client';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  youtubeUrl: string;
  onCompleted: () => void;
  lessonId?: string;
  /** Called ~every 200ms during playback with (watched_seconds, total_seconds). */
  onWatchProgress?: (watched: number, duration: number) => void;
}

/**
 * Pull the 11-char YouTube video ID out of any of the formats authors
 * paste into the lesson editor. Supersedes a much stricter regex that
 * silently rejected `shorts/`, `live/`, `m.youtube.com`, the privacy
 * domain, and bare-ID inputs — leaving the student stuck on
 * "Video URL noto'g'ri" while the same URL rendered fine in the
 * superadmin link list.
 *
 * Supported inputs:
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/watch?v=VIDEO_ID  (with any extra params)
 *   - https://m.youtube.com/watch?v=VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/v/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *   - https://www.youtube.com/live/VIDEO_ID
 *   - https://www.youtube-nocookie.com/embed/VIDEO_ID
 *   - VIDEO_ID  (raw 11-char id)
 *
 * Returns null only when the input has no recognizable 11-char id at all.
 */
function extractVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Bare id — 11 chars, alnum + `-` + `_`.
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // Try real URL parsing first; fall back to regex if the input lacks a
  // protocol or has stray characters that confuse the URL constructor.
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      // /watch?v=ID
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      // /embed/ID, /v/ID, /shorts/ID, /live/ID — second path segment.
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['embed', 'v', 'shorts', 'live'].includes(parts[0])
      ) {
        const id = parts[1];
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* fall through to regex */
  }

  // Last-resort regex sweep: pick any 11-char id that follows a known
  // separator anywhere in the string. Keeps us robust against malformed
  // pastes like trailing whitespace or surrounding quotes.
  const fallback = trimmed.match(
    /(?:v=|\/embed\/|\/shorts\/|\/live\/|\/v\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return fallback ? fallback[1] : null;
}

interface YTPlayer {
  getPlaybackRate: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlayerState: () => number;
  getDuration: () => number;
  getCurrentTime: () => number;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  destroy: () => void;
}

const VIDEO_PROGRESS_PREFIX = 'video_progress_';
const VIDEO_PROGRESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const VIDEO_PROGRESS_HARD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 d

interface VideoProgress {
  position: number;
  percent: number;
  completed: boolean;
  savedAt: number;
}

/**
 * Phase 21.3: drop very old (>30 d) progress entries from localStorage so the
 * key namespace doesn't grow unbounded across many lessons.
 */
function pruneOldVideoProgress() {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const toDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(VIDEO_PROGRESS_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as VideoProgress;
        if (
          typeof data?.savedAt !== 'number' ||
          now - data.savedAt > VIDEO_PROGRESS_HARD_TTL_MS
        ) {
          toDelete.push(key);
        }
      } catch {
        toDelete.push(key);
      }
    }
    toDelete.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // localStorage may be unavailable (private mode, quota); ignore.
  }
}

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | null, config: object) => YTPlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

/**
 * Pass 5 — VideoPlayer light polish:
 *   - Cream-themed surface (was raw black) with rounded video frame
 *   - Warm-yellow lock badge (Tezlashtirish bloklangan) — pill style
 *   - Live progress bar below the video showing % watched in primary green
 *
 * All existing behaviour kept: 1× speed enforcement, restore-on-mount,
 * progress save every 5s, prune stale entries, ≥90% triggers onCompleted.
 */
export function VideoPlayer({ youtubeUrl, onCompleted, lessonId, onWatchProgress }: VideoPlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef(0);
  const completedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Phase 21.3: separate 5s save loop, restore-on-mount, prune old entries.
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef = useRef(false);
  // Maximum playback position reached so far. Forward seeks past this point
  // are reverted; rewinds (seek backward) are allowed.
  const maxAllowedTimeRef = useRef(0);
  // 1.5s tolerance is enough for 1× playback drift (~0.2s per 200ms tick)
  // and catches anything bigger including YouTube's +10s double-tap gesture.
  const SEEK_TOLERANCE_S = 1.5;

  // Pass 5: surface % watched so the progress bar updates live.
  const [percentWatched, setPercentWatched] = useState(0);
  // Brief banner shown when a forward seek is blocked so the user
  // understands why the playhead snapped back.
  const [seekBlockedAt, setSeekBlockedAt] = useState(0);

  const videoId = extractVideoId(youtubeUrl);
  const storageKey = lessonId ? `${VIDEO_PROGRESS_PREFIX}${lessonId}` : null;

  useEffect(() => {
    if (!videoId) return;

    // Prune stale (>30 d) entries on mount to bound localStorage usage.
    pruneOldVideoProgress();

    // Local helper used both by the 200ms poll and by onStateChange to catch
    // YouTube's double-tap +10s gesture as soon as the state event fires,
    // typically a few hundred ms before the next poll tick would catch it.
    const enforceForwardSeekBlock = (): boolean => {
      if (!playerRef.current) return false;
      const current = playerRef.current.getCurrentTime();
      if (
        current > maxAllowedTimeRef.current + SEEK_TOLERANCE_S &&
        typeof playerRef.current.seekTo === 'function'
      ) {
        playerRef.current.seekTo(maxAllowedTimeRef.current, true);
        setSeekBlockedAt(Date.now());
        return true;
      }
      if (current > maxAllowedTimeRef.current) {
        maxAllowedTimeRef.current = current;
      }
      return false;
    };

    const initPlayer = () => {
      playerRef.current = new window.YT.Player(containerRef.current!, {
        videoId,
        playerVars: { modestbranding: 1, rel: 0, controls: 1 },
        events: {
          onStateChange: () => {
            if (playerRef.current) {
              const rate = playerRef.current.getPlaybackRate();
              if (rate !== 1) {
                playerRef.current.setPlaybackRate(1);
              }
              // Catch double-tap +10s and progress-bar drag immediately —
              // YouTube fires a state-change for both before the next poll.
              enforceForwardSeekBlock();
            }
          },
          onReady: () => {
            // Phase 21.3: restore prior position if saved within last 24h.
            if (storageKey && !restoredRef.current && playerRef.current) {
              try {
                const raw = window.localStorage.getItem(storageKey);
                if (raw) {
                  const data = JSON.parse(raw) as VideoProgress;
                  if (
                    typeof data?.savedAt === 'number' &&
                    Date.now() - data.savedAt < VIDEO_PROGRESS_TTL_MS &&
                    typeof data?.position === 'number' &&
                    data.position > 1 &&
                    typeof playerRef.current.seekTo === 'function'
                  ) {
                    playerRef.current.seekTo(data.position, true);
                    // Restored position counts as already-watched: don't snap
                    // the user back to 0 just because we resumed mid-video.
                    maxAllowedTimeRef.current = data.position;
                    if (typeof data.percent === 'number') {
                      watchedRef.current = data.percent;
                      setPercentWatched(data.percent);
                    }
                  }
                }
              } catch {
                // ignore corrupt entries
              }
              restoredRef.current = true;
            }

            intervalRef.current = setInterval(() => {
              if (!playerRef.current) return;
              const state = playerRef.current.getPlayerState();
              const duration = playerRef.current.getDuration();

              // Forward-seek block runs first so the rest of the tick uses
              // the corrected position (otherwise a +10s skip would briefly
              // count toward percentWatched before the next poll snapped it).
              const wasSnapped = enforceForwardSeekBlock();
              const current = wasSnapped
                ? maxAllowedTimeRef.current
                : playerRef.current.getCurrentTime();

              if (duration > 0) {
                const percent = (current / duration) * 100;
                if (percent > watchedRef.current) {
                  watchedRef.current = percent;
                  setPercentWatched(percent);
                }
                onWatchProgress?.(watchedRef.current / 100 * duration, duration);

                if (watchedRef.current >= 90 && !completedRef.current) {
                  completedRef.current = true;
                  onCompleted();
                }
              }

              if (state === window.YT?.PlayerState?.PLAYING) {
                const rate = playerRef.current.getPlaybackRate();
                if (rate !== 1) playerRef.current.setPlaybackRate(1);
              }
            }, 200);

            // Phase 21.3: save progress every 5s.
            if (storageKey) {
              saveIntervalRef.current = setInterval(() => {
                if (!playerRef.current) return;
                try {
                  const position = playerRef.current.getCurrentTime();
                  const duration = playerRef.current.getDuration();
                  const percent = duration > 0 ? (position / duration) * 100 : 0;
                  const payload: VideoProgress = {
                    position,
                    percent,
                    completed: percent >= 90,
                    savedAt: Date.now(),
                  };
                  window.localStorage.setItem(storageKey, JSON.stringify(payload));
                } catch {
                  // quota or permission error — ignore so playback continues.
                }
              }, 5000);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(script);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId, storageKey, onCompleted]);

  if (!videoId) {
    return (
      <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] p-4 rounded-2xl text-[#991b1b] font-bold text-sm">
        Video URL noto&apos;g&apos;ri
      </div>
    );
  }

  const clampedPercent = Math.max(0, Math.min(100, percentWatched));
  const reachedThreshold = clampedPercent >= 90;
  // Banner stays visible for ~2s after the latest blocked seek attempt.
  const seekBlockedRecently = seekBlockedAt > 0 && Date.now() - seekBlockedAt < 2000;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-2 relative">
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
          <div ref={containerRef} className="w-full h-full" />
          {seekBlockedRecently && (
            <div className="absolute inset-x-0 top-0 flex justify-center pt-3 pointer-events-none">
              <div className="bg-[#0f172a]/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                Oldinga o&apos;tkazib bo&apos;lmaydi
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span
            className="text-[#777] font-extrabold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ko&apos;rilgan
          </span>
          <span
            className={`font-extrabold ${reachedThreshold ? 'text-[#10b981]' : 'text-[#7a5e2c]'}`}
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {Math.round(clampedPercent)}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#f3eedf] overflow-hidden">
          <div
            className="h-full bg-[#58cc02] rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${clampedPercent}%` }}
            role="progressbar"
            aria-valuenow={Math.round(clampedPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
}
