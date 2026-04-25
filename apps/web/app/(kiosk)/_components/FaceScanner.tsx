'use client';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    faceapi: any;
  }
}

interface CachedEmbedding {
  user_id: string;
  name: string;
  embedding: number[];
}

interface FaceScannerProps {
  cachedEmbeddings: CachedEmbedding[];
  workStartTime: string;
  lateGraceMinutes: number;
  onMatched: (userId: string, name: string, isLate: boolean, minutes: number) => void;
  onFailed: () => void;
}

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return normA && normB ? dot / (normA * normB) : 0;
}

function computeEAR(eye: { x: number; y: number }[]): number {
  const vertical1 = Math.sqrt((eye[1].x - eye[5].x) ** 2 + (eye[1].y - eye[5].y) ** 2);
  const vertical2 = Math.sqrt((eye[2].x - eye[4].x) ** 2 + (eye[2].y - eye[4].y) ** 2);
  const horizontal = Math.sqrt((eye[0].x - eye[3].x) ** 2 + (eye[0].y - eye[3].y) ** 2);
  return (vertical1 + vertical2) / (2 * horizontal);
}

const EAR_THRESHOLD = 0.25;
const BLINK_FRAMES = 3;
const RECOGNITION_THRESHOLD = 0.80;

export function FaceScanner({
  cachedEmbeddings,
  workStartTime,
  lateGraceMinutes,
  onMatched,
  onFailed,
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'liveness' | 'recognizing'>('loading');
  const [livenessInstruction, setLivenessInstruction] = useState("Ko'zingizni yumib oching");
  const blinkCountRef = useRef(0);
  const earBelowRef = useRef(0);
  const failCountRef = useRef(0);
  const detectedEmbeddingRef = useRef<number[] | null>(null);
  const statusRef = useRef<'loading' | 'scanning' | 'liveness' | 'recognizing'>('loading');

  function isLateArrival(workStart: string, graceMinutes: number): { late: boolean; minutes: number } {
    const now = new Date();
    const [h, m] = workStart.split(':').map(Number);
    const workTime = new Date(now);
    workTime.setHours(h, m + graceMinutes, 0, 0);
    const diffMin = Math.floor((now.getTime() - workTime.getTime()) / 60000);
    return { late: diffMin > 0, minutes: Math.max(0, diffMin) };
  }

  function matchEmbedding(queryEmbedding: number[]): { userId: string; name: string } | null {
    let best = { userId: '', name: '', confidence: 0 };
    for (const cached of cachedEmbeddings) {
      const sim = cosineSim(queryEmbedding, cached.embedding);
      if (sim > best.confidence) best = { userId: cached.user_id, name: cached.name, confidence: sim };
    }
    return best.confidence >= RECOGNITION_THRESHOLD ? { userId: best.userId, name: best.name } : null;
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let stream: MediaStream | null = null;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.onload = async () => {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;

      statusRef.current = 'scanning';
      setStatus('scanning');

      interval = setInterval(async () => {
        if (!videoRef.current || !window.faceapi) return;

        const detections = await window.faceapi
          .detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (!detections.length) return;

        const detection = detections[0];
        const embedding = Array.from(detection.descriptor as Float32Array) as number[];

        if (statusRef.current === 'scanning') {
          detectedEmbeddingRef.current = embedding;
          statusRef.current = 'liveness';
          setStatus('liveness');
        } else if (statusRef.current === 'liveness') {
          const leftEye = detection.landmarks.getLeftEye();
          const rightEye = detection.landmarks.getRightEye();
          const ear = (computeEAR(leftEye) + computeEAR(rightEye)) / 2;

          if (ear < EAR_THRESHOLD) {
            earBelowRef.current++;
            if (earBelowRef.current >= BLINK_FRAMES) {
              earBelowRef.current = 0;
              blinkCountRef.current++;
              setLivenessInstruction("✅ Ko'z pirpirash aniqlandi!");

              // Move to recognizing — interval keeps running but we gate on statusRef
              statusRef.current = 'recognizing';
              setStatus('recognizing');

              const match = matchEmbedding(detectedEmbeddingRef.current!);
              if (match) {
                // Stop polling on confirmed match
                if (interval) clearInterval(interval);
                const { late, minutes } = isLateArrival(workStartTime, lateGraceMinutes);
                onMatched(match.userId, match.name, late, minutes);
              } else {
                failCountRef.current++;
                if (failCountRef.current >= 3) {
                  // Stop polling on final failure
                  if (interval) clearInterval(interval);
                  onFailed();
                } else {
                  // Reset for next attempt — interval keeps running
                  detectedEmbeddingRef.current = null;
                  earBelowRef.current = 0;
                  statusRef.current = 'scanning';
                  setStatus('scanning');
                }
              }
            }
          } else {
            earBelowRef.current = 0;
          }
        }
        // When status === 'recognizing' the interval may still fire; we do nothing until
        // the match/fail branch above updates statusRef.
      }, 300);
    };
    document.head.appendChild(script);

    return () => {
      if (interval) clearInterval(interval);
      stream?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-2xl" />
      <div className="absolute bottom-4 left-0 right-0 text-center">
        {status === 'loading' && (
          <p className="text-white bg-black/60 rounded-full px-4 py-2 mx-4 text-sm">Kamera yuklanmoqda...</p>
        )}
        {status === 'scanning' && (
          <p className="text-white bg-black/60 rounded-full px-4 py-2 mx-4 text-sm">Yuzingizni ko&apos;rsating...</p>
        )}
        {status === 'liveness' && (
          <p className="text-white bg-indigo-600/80 rounded-full px-4 py-2 mx-4 text-sm animate-pulse">
            👁 {livenessInstruction}
          </p>
        )}
        {status === 'recognizing' && (
          <p className="text-white bg-black/60 rounded-full px-4 py-2 mx-4 text-sm">⏳ Aniqlanmoqda...</p>
        )}
      </div>
    </div>
  );
}
