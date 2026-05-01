'use client';
import { Newspaper } from 'lucide-react';
import { SocialFeed } from '../_components/SocialFeed';

export default function StudentLentaPage() {
  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center">
            <Newspaper size={20} className="text-[#f59e0b]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Oʻquvchi</p>
            <p className="text-white text-lg font-bold">Doʻstlar lentasi</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 max-w-lg mx-auto">
        <SocialFeed />
      </div>
    </div>
  );
}
