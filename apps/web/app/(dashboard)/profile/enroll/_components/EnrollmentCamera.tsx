'use client';
import { useState, useRef, useCallback } from 'react';

interface EnrollmentCameraProps {
  onComplete: (images: string[]) => void;
}

const INSTRUCTIONS = [
  "📷 To'g'ri qarang",
  '👈 Chapga qarang',
  "👉 O'ngga qarang",
  '⬆️ Yuqoriga qarang',
  '⬇️ Pastga qarang',
];

export function EnrollmentCamera({ onComplete }: EnrollmentCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setStreaming(true);
    }
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    const newImages = [...images, base64];
    setImages(newImages);

    if (step + 1 < INSTRUCTIONS.length) {
      setStep((s) => s + 1);
    } else {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((t) => t.stop());
      onComplete(newImages);
    }
  }, [images, step, onComplete]);

  return (
    <div className="space-y-4">
      {!streaming ? (
        <button
          onClick={startCamera}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          📷 Kamerani yoqish
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1">
            {INSTRUCTIONS.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i < images.length ? 'bg-green-500' : i === step ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-center font-medium text-indigo-600">{INSTRUCTIONS[step]}</p>
          <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl" />
          <button
            onClick={captureImage}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
          >
            📸 Rasm olish ({step + 1}/5)
          </button>
        </div>
      )}
    </div>
  );
}
