'use client';
import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  youtubeUrl: string;
  onCompleted: () => void;
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&\s]{11})/);
  return match ? match[1] : null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({ youtubeUrl, onCompleted }: VideoPlayerProps) {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const watchedRef = useRef(0);
  const completedRef = useRef(false);

  const videoId = extractVideoId(youtubeUrl);

  useEffect(() => {
    if (!videoId) return;

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
            const interval = setInterval(() => {
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

            return () => clearInterval(interval);
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
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId]);

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
