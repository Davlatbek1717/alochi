'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, MessageCircle, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton } from '@/components/ui';
import { getGroupIdFromToken } from '@/lib/jwt';

type Profile = {
  id: string;
  name: string;
  groupId?: string | null;
  branch?: { id: string; name?: string } | null;
  group?: { id: string; name?: string } | null;
};

export default function StudentGroupsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const groupId = getGroupIdFromToken();
    Promise.all([
      apiRequest<Profile>('/users/my-profile', {}, token),
      groupId
        ? apiRequest<Array<{ id: string; role: string }>>(`/users/group/${groupId}`, {}, token).catch(() => ({ data: [] as Array<{ id: string; role: string }> }))
        : Promise.resolve({ data: [] as Array<{ id: string; role: string }> }),
    ])
      .then(([p, members]) => {
        setProfile(p.data);
        setMemberCount((members.data ?? []).filter((u) => u.role === 'student').length);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'))
      .finally(() => setLoading(false));
  }, []);

  const groupId = profile?.groupId ?? profile?.group?.id ?? getGroupIdFromToken();
  const groupName = profile?.group?.name ?? 'Mening guruhim';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0d9488]/15 border border-[#0d9488]/30 flex items-center justify-center">
            <GraduationCap size={20} className="text-[#0d9488]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Oʻquvchi</p>
            <p className="text-white text-lg font-bold">Mening guruhim</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-3 max-w-lg mx-auto">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">{error}</div>
        )}

        {loading ? (
          <Skeleton className="h-24 rounded-2xl" theme="light" />
        ) : !groupId ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<GraduationCap size={28} />}
              title="Guruh tayinlanmagan"
              description="Filadmin sizni guruhga qoʻshganidan keyin koʻrinadi"
              theme="light"
            />
          </div>
        ) : (
          <Link
            href={`/student/groups/${groupId}/chat`}
            className="block bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 hover:border-[#cbd5e1] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#0d9488]/10 border border-[#0d9488]/20 flex items-center justify-center text-[#0d9488] shrink-0">
                <MessageCircle size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#0f172a] text-base font-bold truncate">{groupName}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {memberCount > 0 ? `${memberCount} ta oʻquvchi` : 'Guruh chati'}
                  {profile?.branch?.name ? ` · ${profile.branch.name}` : ''}
                </p>
              </div>
              <ChevronRight size={18} className="text-[#94a3b8] shrink-0" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
