'use client';
import { Video } from 'lucide-react';
import { VideoMonitoringBoard } from '../../_components/VideoMonitoringBoard';

export default function SuperadminVideoMonitoringPage() {
  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
            <Video size={20} className="text-[#5eead4]" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight">
              Video monitoring
            </h1>
            <p className="text-[#94a3b8] text-xs font-medium">
              Butun tashkilot bo&apos;yicha kunlik video tekshir
            </p>
          </div>
        </div>
      </div>
      <VideoMonitoringBoard />
    </div>
  );
}
