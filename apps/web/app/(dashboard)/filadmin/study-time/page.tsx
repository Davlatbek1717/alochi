'use client';
import { Clock } from 'lucide-react';
import { StudyTimeBoard } from '../../_components/StudyTimeBoard';

export default function FiladminStudyTimePage() {
  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
            <h1 className="text-white text-lg font-bold leading-tight">
              O&apos;quv vaqti
            </h1>
            <p className="text-[#475569] text-xs mt-0.5">
              Filial bo&apos;yicha kunlik va oraliq hisobot
            </p>
          </div>
        </div>
      </div>
      <StudyTimeBoard canEditThreshold />
    </div>
  );
}
