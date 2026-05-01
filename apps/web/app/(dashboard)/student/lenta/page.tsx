'use client';
import { Newspaper } from 'lucide-react';
import { SocialFeed } from '../_components/SocialFeed';

export default function StudentLentaPage() {
  return (
    <div className="min-h-full bg-[#fffaf0] pb-8">
      {/* Sticky cream header */}
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Newspaper size={20} className="text-[#1cb0f6]" />
          <h1 className="text-[#0f172a] text-lg font-extrabold">
            Doʻstlar lentasi
          </h1>
        </div>
      </header>

      <div className="px-4 pt-5 pb-6 max-w-lg mx-auto">
        <SocialFeed />
      </div>
    </div>
  );
}
