'use client';
import { useEffect } from 'react';

interface AttendanceResultProps {
  name: string;
  time: string;
  isLate: boolean;
  lateMinutes: number;
  onDone: () => void;
}

export function AttendanceResult({ name, time, isLate, lateMinutes, onDone }: AttendanceResultProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="text-center space-y-3 p-8 bg-white/10 rounded-3xl backdrop-blur-sm">
      <div className="text-6xl animate-bounce">
        {isLate ? '⏰' : '✅'}
      </div>
      <p className="text-2xl font-bold text-white">Xush kelibsiz!</p>
      <p className="text-xl text-white/90">{name}</p>
      <p className="text-white/70">Kelish vaqti: {time}</p>
      {isLate && (
        <p className="text-yellow-300 font-medium">⚠️ {lateMinutes} daqiqa kech keldi</p>
      )}
      {!isLate && (
        <p className="text-green-300 font-medium">✅ O&apos;z vaqtida</p>
      )}
    </div>
  );
}
