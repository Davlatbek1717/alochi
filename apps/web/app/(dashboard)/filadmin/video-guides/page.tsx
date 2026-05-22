'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Video, Play } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState } from '@/components/ui';

interface Guide {
  id: string;
  title: string;
  role: string;
  videoUrl: string;
  order: number;
}

/** Extract a short display label from a URL (domain only, or "youtube.com") */
function urlLabel(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

/** True only for https:// links */
function safeHref(url: string): string {
  return url.startsWith('https://') ? url : '#';
}

export default function FiladminVideoGuidesPage() {
  const router = useRouter();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Guide[]>('/staff-guides?role=filadmin', {}, token)
      .then((r) => setGuides(r.data ?? []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
              <Video size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
              <p className="text-white text-lg font-bold">Video qo&apos;llanmalar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} theme="light" className="h-16 w-full rounded-[18px]" />
            ))}
          </div>
        ) : guides.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Video size={28} />}
              title="Hali qo'llanma yo'q"
              description="Video qo'llanmalar tez orada qo'shiladi"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map((g) => (
              <a
                key={g.id}
                href={safeHref(g.videoUrl)}
                target="_blank"
                rel="noreferrer noopener"
                className="block bg-white border-[1.5px] border-[#ede9e1] rounded-[18px] p-4 hover:bg-[#f7f4ef] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                    <Play size={18} className="text-[#0d9488]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0f172a] text-sm truncate">
                      {g.title}
                    </p>
                    <p className="text-xs text-[#64748b] truncate mt-0.5">
                      YouTube ko&apos;rish · {urlLabel(g.videoUrl)}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
