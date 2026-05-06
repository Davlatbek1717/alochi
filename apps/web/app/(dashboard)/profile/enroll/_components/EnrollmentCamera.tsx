'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    faceapi: any;
  }
}

interface EnrollmentCameraProps {
  /**
   * Called once 5 face descriptor vectors have been captured.
   * Each vector is 128 floats (face-api.js FaceRecognitionNet output).
   * Raw images NEVER leave the browser — PDPL §533 compliance.
   */
  onComplete: (embeddings: number[][]) => void;
}

const INSTRUCTIONS = [
  "📷 To'g'ri qarang",
  '👈 Chapga qarang',
  "👉 O'ngga qarang",
  '⬆️ Yuqoriga qarang',
  '⬇️ Pastga qarang',
];

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';

export function EnrollmentCamera({ onComplete }: EnrollmentCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0);
  const [embeddings, setEmbeddings] = useState<number[][]>([]);
  const [streaming, setStreaming] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Load face-api.js + weights once on mount
  useEffect(() => {
    let cancelled = false;
    const existing = document.querySelector(`script[src="${FACE_API_CDN}"]`);
    const script = (existing as HTMLScriptElement | null) ?? document.createElement('script');
    if (!existing) {
      script.src = FACE_API_CDN;
      document.head.appendChild(script);
    }
    const onLoad = async () => {
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        if (!cancelled) setModelsReady(true);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Modellar yuklanmadi');
      }
    };
    if (window.faceapi?.nets?.faceRecognitionNet?.isLoaded) {
      onLoad();
    } else {
      script.addEventListener('load', onLoad);
    }
    return () => {
      cancelled = true;
      script.removeEventListener('load', onLoad);
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kamerani yoqib bo\'lmadi');
    }
  }, []);

  const captureDescriptor = useCallback(async () => {
    if (!videoRef.current || !modelsReady || busy) return;
    setBusy(true);
    setError('');
    try {
      const detection = await window.faceapi
        .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection || !detection.descriptor) {
        setError('Yuz aniqlanmadi — yorug\'lik va burchakni tekshiring');
        return;
      }

      // Convert Float32Array → number[]; this is the only thing that ever leaves the browser
      const vector = Array.from(detection.descriptor as Float32Array) as number[];
      const next = [...embeddings, vector];
      setEmbeddings(next);

      if (step + 1 < INSTRUCTIONS.length) {
        setStep((s) => s + 1);
      } else {
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach((t) => t.stop());
        onComplete(next);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Aniqlashda xato');
    } finally {
      setBusy(false);
    }
  }, [embeddings, step, onComplete, modelsReady, busy]);

  return (
    <div className="space-y-4">
      {!streaming ? (
        <button
          onClick={startCamera}
          disabled={!modelsReady}
          className="w-full bg-indigo-600 disabled:bg-indigo-300 text-white py-3 rounded-xl font-medium"
        >
          {modelsReady ? '📷 Kamerani yoqish' : 'Modellar yuklanmoqda…'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1">
            {INSTRUCTIONS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i < embeddings.length
                    ? 'bg-green-500'
                    : i === step
                      ? 'bg-indigo-500'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-center font-medium text-indigo-600">{INSTRUCTIONS[step]}</p>
          <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl" />
          <button
            onClick={captureDescriptor}
            disabled={busy || !modelsReady}
            className="w-full bg-indigo-600 disabled:bg-indigo-300 text-white py-3 rounded-xl font-medium"
          >
            {busy ? 'Aniqlanmoqda…' : `📸 Skaner (${step + 1}/5)`}
          </button>
          {error && (
            <p className="text-center text-sm text-rose-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
