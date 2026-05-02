'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraMonitorProps {
  onLookAway: () => void;
  onSilenceTooLong: () => void;
}

// Sustained-violation thresholds (ms). Tuned for exam strictness —
// shorter than the original 2 s so that turning the head triggers
// quickly, but long enough that a brief glance away or a sneeze
// doesn't burn a warning.
const NO_FACE_GRACE_MS = 1200;
const POSE_VIOLATION_GRACE_MS = 1500;

type Landmark = { x: number; y: number };
type Detection = {
  boundingBox?: { xCenter: number; yCenter: number; width: number; height: number };
  landmarks?: Landmark[];
};

/**
 * Returns an Uzbek violation message when the face is in frame but
 * the student isn't actually looking at the screen — head turned,
 * tilted up/down, or way off-center. Returns null when the pose is
 * acceptable. Keypoint indices follow Mediapipe's FaceDetection
 * keypoint enum:
 *   0 RIGHT_EYE  1 LEFT_EYE  2 NOSE_TIP  3 MOUTH_CENTER
 *   4 RIGHT_EAR_TRAGION  5 LEFT_EAR_TRAGION
 */
function detectPoseViolation(d: Detection): string | null {
  const lm = d.landmarks;
  if (!lm || lm.length < 4) return null;
  const rightEye = lm[0];
  const leftEye = lm[1];
  const nose = lm[2];
  const mouth = lm[3];
  if (!rightEye || !leftEye || !nose || !mouth) return null;

  const eyeMidX = (rightEye.x + leftEye.x) / 2;
  const eyeMidY = (rightEye.y + leftEye.y) / 2;
  const eyeDist = Math.abs(rightEye.x - leftEye.x);

  // Face too small / unreliable — student is too far from camera.
  if (eyeDist < 0.04) return "Kameraga yaqinroq keling";

  // YAW (left-right head turn): when the head rotates away from the
  // camera, the nose-tip's x-coordinate drifts from the midpoint
  // between the eyes. Normalising by eye distance keeps the threshold
  // scale-invariant.
  const yawRatio = (nose.x - eyeMidX) / eyeDist;
  if (Math.abs(yawRatio) > 0.35) return "Kameraga to'g'ri qarang";

  // PITCH (up-down tilt): nose lies between eyes and mouth on a
  // forward-facing face. As the head tilts up, the nose sits closer
  // to the eye line; tilting down, closer to the mouth. We accept
  // 0.2..0.7 as roughly forward.
  const eyeToMouth = mouth.y - eyeMidY;
  if (eyeToMouth > 0.001) {
    const noseRatio = (nose.y - eyeMidY) / eyeToMouth;
    if (noseRatio < 0.15 || noseRatio > 0.75) {
      return "Kameraga to'g'ri qarang";
    }
  }

  // Off-center: bounding box drifted into a corner of the frame —
  // the student is sitting sideways or far from centre.
  const bb = d.boundingBox;
  if (bb) {
    if (bb.xCenter < 0.18 || bb.xCenter > 0.82) return 'Kamera markazida turing';
    if (bb.yCenter < 0.18 || bb.yCenter > 0.82) return 'Kamera markazida turing';
  }

  return null;
}

export function CameraMonitor({ onLookAway, onSilenceTooLong }: CameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Two independent sustained-violation timers — "no face" vs. "wrong
  // pose" — so transitioning between the two states (turning the head
  // until the face leaves frame) doesn't accidentally reset the counter.
  const noFaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which message a pose timer was scheduled for so we don't
  // queue a fresh timeout when the same violation persists.
  const pendingPoseMsgRef = useRef<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [poseOk, setPoseOk] = useState(true);
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
    let stream: MediaStream | null = null;

    async function init() {
      // Mediapipe ships UMD bundles that attach `FaceDetection` and
      // `Camera` to `window` as a side-effect of being imported —
      // there are no named ESM exports. So we await the imports for
      // the side-effect, then read the constructors off the window.
      await import('@mediapipe/face_detection');
      await import('@mediapipe/camera_utils');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const FaceDetection = w.FaceDetection;
      const Camera = w.Camera;
      if (typeof FaceDetection !== 'function' || typeof Camera !== 'function') {
        console.error('[CameraMonitor] Mediapipe globals not registered');
        return;
      }

      const mp = new FaceDetection({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
      });

      mp.setOptions({ model: 'short', minDetectionConfidence: 0.5 });

      mp.onResults((results: { detections: Detection[] }) => {
        const detections = results.detections ?? [];

        // ── Path A: no face in frame ──
        if (detections.length === 0) {
          // Cancel any pose timer — the "no face" path takes over.
          if (poseTimerRef.current) {
            clearTimeout(poseTimerRef.current);
            poseTimerRef.current = null;
            pendingPoseMsgRef.current = null;
          }
          setPoseOk(false);
          if (!noFaceTimerRef.current) {
            noFaceTimerRef.current = setTimeout(() => {
              showWarning('Kameraga qarang!');
              noFaceTimerRef.current = null;
            }, NO_FACE_GRACE_MS);
          }
          return;
        }

        // Face is in frame — clear no-face timer.
        if (noFaceTimerRef.current) {
          clearTimeout(noFaceTimerRef.current);
          noFaceTimerRef.current = null;
        }

        // ── Path B: face is in frame, check head pose ──
        // Use the largest detection (closest face) when several are
        // visible — covers the case where someone walks behind.
        const primary = detections.reduce((best, d) => {
          const bw = best?.boundingBox?.width ?? 0;
          const dw = d?.boundingBox?.width ?? 0;
          return dw > bw ? d : best;
        }, detections[0]);

        const violation = detectPoseViolation(primary);

        if (violation) {
          setPoseOk(false);
          // Only schedule a fresh timer when no timer is pending OR
          // when the violation message changed. This lets the timer
          // accumulate across consecutive frames showing the same
          // violation rather than restarting on every onResults call.
          if (!poseTimerRef.current || pendingPoseMsgRef.current !== violation) {
            if (poseTimerRef.current) clearTimeout(poseTimerRef.current);
            pendingPoseMsgRef.current = violation;
            poseTimerRef.current = setTimeout(() => {
              showWarning(violation);
              poseTimerRef.current = null;
              pendingPoseMsgRef.current = null;
            }, POSE_VIOLATION_GRACE_MS);
          }
        } else {
          // Pose is fine — clear any pending pose-warning timer so
          // the student doesn't get punished for a momentary glance.
          if (poseTimerRef.current) {
            clearTimeout(poseTimerRef.current);
            poseTimerRef.current = null;
            pendingPoseMsgRef.current = null;
          }
          setPoseOk(true);
        }
      });

      mpInstance = mp;

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
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
      if (noFaceTimerRef.current) clearTimeout(noFaceTimerRef.current);
      if (poseTimerRef.current) clearTimeout(poseTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (cameraInstance) cameraInstance.stop();
      if (mpInstance) mpInstance.close();
      stream?.getTracks().forEach((t) => t.stop());
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

      {/* Status pill — green dot when face + pose are fine, amber
          when something's wrong. Gives the student instant feedback
          before the warning timer fires. */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className={`w-1.5 h-1.5 rounded-full ${
            poseOk ? 'bg-emerald-400' : 'bg-amber-400 motion-safe:animate-pulse'
          }`}
        />
        {poseOk ? 'Yuz aniqlandi' : 'Kameraga to\'g\'ri qarang'}
      </div>
    </div>
  );
}
