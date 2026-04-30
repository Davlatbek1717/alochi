'use client';
import { useEffect } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

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
    <div className="text-center space-y-4 p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-sm max-w-xs w-full mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${isLate ? 'bg-amber-500/20 border-2 border-amber-400/40' : 'bg-emerald-500/20 border-2 border-emerald-400/40'}`}>
        {isLate
          ? <Clock size={36} className="text-amber-300" />
          : <CheckCircle2 size={36} className="text-emerald-300" />
        }
      </div>
      <div>
        <p className="text-2xl font-black text-white">Xush kelibsiz!</p>
        <p className="text-lg text-white/80 mt-1 font-semibold">{name}</p>
      </div>
      <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${isLate ? 'bg-amber-500/10 border border-amber-400/20 text-amber-300' : 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-300'}`}>
        <p>Kelish vaqti: {time}</p>
        {isLate ? (
          <p className="mt-0.5 text-amber-400/80">{lateMinutes} daqiqa kech keldi</p>
        ) : (
          <p className="mt-0.5 text-emerald-400/80">O&apos;z vaqtida</p>
        )}
      </div>
    </div>
  );
}
