'use client';
import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  youtubeUrl: string;
  onCompleted: () => void;
  lessonId?: string;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&\s]{11})/);
  return match ? match[1] : null;
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

export function VideoPlayer({ youtubeUrl, onCompleted, lessonId }: VideoPlayerProps) {
  const playerRef = useRef<YTPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef(0);
  const completedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Phase 21.3: separate 5s save loop, restore-on-mount, prune old entries.
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef = useRef(false);

  const videoId = extractVideoId(youtubeUrl);
  const storageKey = lessonId ? `${VIDEO_PROGRESS_PREFIX}${lessonId}` : null;

  useEffect(() => {
    if (!videoId) return;

    // Prune stale (>30 d) entries on mount to bound localStorage usage.
    pruneOldVideoProgress();

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
                    if (typeof data.percent === 'number') {
                      watchedRef.current = data.percent;
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
              const current = playerRef.current.getCurrentTime();

              if (duration > 0) {
                const percent = (current / duration) * 100;
                if (percent > watchedRef.current) watchedRef.current = percent;

                if (watchedRef.current >= 90 && !completedRef.current) {
                  completedRef.current = true;
                  onCompleted();
                }
              }

              if (state === window.YT?.PlayerState?.PLAYING) {
                const rate = playerRef.current.getPlaybackRate();
                if (rate !== 1) playerRef.current.setPlaybackRate(1);
              }
            }, 500);

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
  }, [videoId, storageKey]);

  if (!videoId) {
    return <div className="bg-red-100 p-4 rounded-lg text-red-700">Video URL noto&apos;g&apos;ri</div>;
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        🔒 Tezlashtirish bloklangan
      </div>
    </div>
  );
}
