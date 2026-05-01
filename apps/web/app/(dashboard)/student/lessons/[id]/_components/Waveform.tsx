'use client';
import { useEffect, useRef } from 'react';

/**
 * Pass 5 helper — 5-bar live waveform driven by an AnalyserNode RMS reading.
 *
 * Behaviour:
 *  - When `active === false`, all 5 bars rest at a small idle height with a
 *    soft pulse (CSS keyframe-driven, GPU-cheap).
 *  - When `active === true` and a `stream` is provided, we attach an
 *    AudioContext + AnalyserNode to it and drive bar heights from the moving
 *    RMS, scaled per-bar so each bar has its own personality.
 *
 * No props mutate the stream; we only read from it via a MediaStreamSource.
 * The AudioContext is created lazily on activation and torn down on cleanup
 * so that mic resources never linger.
 */
interface WaveformProps {
  stream: MediaStream | null;
  active: boolean;
  className?: string;
}

const BAR_COUNT = 5;

export function Waveform({ stream, active, className = '' }: WaveformProps) {
  const barsRef = useRef<Array<HTMLDivElement | null>>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      // Cleanup if we were running.
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyserRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      // Reset bar heights.
      barsRef.current.forEach((el) => {
        if (el) el.style.height = '20%';
      });
      return;
    }

    // Set up AudioContext + AnalyserNode lazily when activation starts.
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    const ctx = new AudioCtxCtor();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyserRef.current = analyser;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      // RMS of the buffer normalised to 0..1.
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / buf.length);
      // Pump up so quiet voices still register.
      const level = Math.min(1, rms * 3.5);

      barsRef.current.forEach((el, i) => {
        if (!el) return;
        // Each bar gets a slightly different scale + offset so the row dances.
        const variance = 0.65 + 0.35 * Math.sin((Date.now() / 120) + i * 1.4);
        const h = Math.max(0.18, level * variance);
        el.style.height = `${Math.round(h * 100)}%`;
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      if (ctx.state !== 'closed') {
        void ctx.close().catch(() => {});
      }
    };
  }, [active, stream]);

  return (
    <div
      className={`flex items-end justify-center gap-1.5 h-12 w-full ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className={`w-2 rounded-full bg-[#58cc02] transition-[height] duration-75 ${
            !active ? 'motion-safe:[animation:pop_1.2s_ease-in-out_infinite]' : ''
          }`}
          style={{
            height: '20%',
            animationDelay: !active ? `${i * 120}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default Waveform;
