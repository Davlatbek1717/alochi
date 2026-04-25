'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraMonitorProps {
  onLookAway: () => void;
  onSilenceTooLong: () => void;
}

export function CameraMonitor({ onLookAway, onSilenceTooLong }: CameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lookAwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [warning, setWarning] = useState('');
  const warningTimesRef = useRef(0);

  const showWarning = useCallback(
    (msg: string) => {
      setWarning(msg);
      warningTimesRef.current += 1;

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'uz-UZ';
        utterance.rate = 1.2;
        window.speechSynthesis.speak(utterance);
      }

      setTimeout(() => setWarning(''), 3000);

      if (warningTimesRef.current >= 3) {
        onLookAway();
      }
    },
    [onLookAway],
  );

  useEffect(() => {
    let cameraInstance: { stop: () => void } | null = null;
    let mpInstance: { close: () => void } | null = null;

    async function init() {
      const { FaceDetection } = await import(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '@mediapipe/face_detection' as any
      );
      const { Camera } = await import(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        '@mediapipe/camera_utils' as any
      );

      const mp = new FaceDetection({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
      });

      mp.setOptions({ model: 'short', minDetectionConfidence: 0.5 });

      mp.onResults((results: { detections: unknown[] }) => {
        if (!results.detections || results.detections.length === 0) {
          if (!lookAwayTimerRef.current) {
            lookAwayTimerRef.current = setTimeout(() => {
              showWarning('Kameraga qarang!');
            }, 2000);
          }
        } else {
          if (lookAwayTimerRef.current) {
            clearTimeout(lookAwayTimerRef.current);
            lookAwayTimerRef.current = null;
          }
        }
      });

      mpInstance = mp;

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }

      const camera = new Camera(videoRef.current!, {
        onFrame: async () => {
          if (videoRef.current) await mp.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
      cameraInstance = camera;
    }

    init().catch(console.error);

    silenceTimerRef.current = setTimeout(() => {
      onSilenceTooLong();
    }, 30000);

    return () => {
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (cameraInstance) cameraInstance.stop();
      if (mpInstance) mpInstance.close();
    };
  }, [showWarning, onSilenceTooLong]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full rounded-xl bg-black"
        onPlay={() => setCameraReady(true)}
      />
      <canvas ref={canvasRef} className="hidden" />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-xl">
          <p className="text-white text-sm">Kamera yuklanmoqda...</p>
        </div>
      )}

      {warning && (
        <div className="absolute top-2 left-0 right-0 mx-4 bg-red-500 text-white text-center py-2 px-4 rounded-lg font-medium animate-pulse">
          ⚠️ {warning}
        </div>
      )}

      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        📷 Kamera yoqiq
      </div>
    </div>
  );
}
