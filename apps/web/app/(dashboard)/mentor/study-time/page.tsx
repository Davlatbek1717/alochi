'use client';
import Link from 'next/link';
import { Clock, ArrowLeft } from 'lucide-react';
import { StudyTimeBoard } from '../../_components/StudyTimeBoard';

export default function MentorStudyTimePage() {
  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/mentor"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">Mentor</p>
            <h1 className="text-white text-lg font-extrabold leading-tight">
              O&apos;quv vaqti
            </h1>
            <p className="text-[#475569] text-[11px] font-bold mt-0.5">
              Guruhingiz bo&apos;yicha kunlik va oraliq hisobot
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-violet-300" />
          </div>
        </div>
      </div>
      <StudyTimeBoard />
    </div>
  );
}
