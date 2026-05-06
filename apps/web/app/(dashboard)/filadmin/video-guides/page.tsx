'use client';
import { useEffect, useState } from 'react';
import { Video, Play } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton } from '@/components/ui';

interface Guide {
  id: string;
  title: string;
  role: string;
  videoUrl: string;
  order: number;
}

export default function FiladminVideoGuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Guide[]>('/staff-guides?role=filadmin', {}, token)
      .then((r) => setGuides(r.data))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Video className="text-blue-500" size={20} />
        <h1 className="text-lg font-bold text-gray-800">Video qo&apos;llanmalar</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} theme="light" className="h-16 w-full" />
          ))}
        </div>
      ) : guides.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">
          Hali qo&apos;llanma yo&apos;q
        </p>
      ) : (
        <div className="space-y-2">
          {guides.map((g) => (
            <a
              key={g.id}
              href={g.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="block bg-white border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Play size={18} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">
                    {g.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{g.videoUrl}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
