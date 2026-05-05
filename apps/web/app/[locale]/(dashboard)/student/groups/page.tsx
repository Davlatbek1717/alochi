'use client';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { GraduationCap, MessageCircle, ChevronRight, Users } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Mascot, Skeleton } from '@/components/ui';
import { getGroupIdFromToken } from '@/lib/jwt';

type Profile = {
  id: string;
  name: string;
  groupId?: string | null;
  branch?: { id: string; name?: string } | null;
  group?: { id: string; name?: string } | null;
};

type GroupMember = { id: string; role: string; name?: string };

export default function StudentGroupsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const groupId = getGroupIdFromToken();
    Promise.all([
      apiRequest<Profile>('/users/my-profile', {}, token),
      groupId
        ? apiRequest<GroupMember[]>(`/users/group/${groupId}`, {}, token).catch(
            () => ({ data: [] as GroupMember[] }),
          )
        : Promise.resolve({ data: [] as GroupMember[] }),
    ])
      .then(([p, m]) => {
        setProfile(p.data);
        const all = m.data ?? [];
        setMembers(all.filter((u) => u.role === 'student'));
        setMemberCount(all.filter((u) => u.role === 'student').length);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Yuklab boʻlmadi'),
      )
      .finally(() => setLoading(false));
  }, []);

  const groupId = profile?.groupId ?? profile?.group?.id ?? getGroupIdFromToken();
  const groupName = profile?.group?.name ?? 'Mening guruhim';

  return (
    <div className="min-h-full bg-[#fffaf0] pb-8">
      <header className="sticky top-0 z-10 bg-[#fffaf0]/90 backdrop-blur border-b-[1.5px] border-[#ede9e1] px-4 py-3">
        <div className="max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl flex items-center gap-3">
          <GraduationCap size={20} className="text-[#10b981]" />
          <h1 className="text-[#0f172a] text-lg font-extrabold">Mening guruhim</h1>
        </div>
      </header>

      <div className="px-4 md:px-6 pt-5 pb-6 space-y-3 max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <Skeleton className="h-24 rounded-2xl" theme="light" />
        ) : !groupId ? (
          <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-8 text-center space-y-3">
            <Mascot expression="sleeping" size={120} className="mx-auto" />
            <div>
              <p className="text-[#0f172a] font-bold text-lg">
                Guruh tayinlanmagan
              </p>
              <p className="text-[#64748b] text-sm mt-1">
                Filadmin sizni guruhga qoʻshganidan keyin koʻrinadi.
              </p>
            </div>
          </div>
        ) : (
          <>
            <Link
              href={`/student/groups/${groupId}/chat`}
              className="block bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-4 md:p-5 hover:border-[#10b981] md:hover:-translate-y-0.5 hover:shadow-md transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#10b981] to-[#047857] flex items-center justify-center text-white shrink-0 shadow">
                  <MessageCircle size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-base font-extrabold truncate">
                    {groupName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-xs text-[#64748b]">
                      <Users size={11} />
                      {memberCount > 0
                        ? `${memberCount} ta oʻquvchi`
                        : 'Guruh chati'}
                    </span>
                    {profile?.branch?.name && (
                      <span className="text-xs text-[#94a3b8]">
                        · {profile.branch.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider mt-1">
                    Chatga oʻtish →
                  </p>
                </div>
                <ChevronRight size={18} className="text-[#94a3b8] shrink-0" />
              </div>
            </Link>

            {/* Avatar strip */}
            {members.length > 0 && (
              <div className="bg-white rounded-[20px] border-[1.5px] border-[#ede9e1] p-4 md:p-5">
                <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-3">
                  Guruh aʼzolari · {memberCount} ta
                </p>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {members.slice(0, 18).map((m) => (
                    <div
                      key={m.id}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#d97706] border-2 border-white shadow flex items-center justify-center text-white font-extrabold text-sm md:text-base"
                      title={m.name ?? ''}
                    >
                      {(m.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {members.length > 18 && (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#fffaf0] border-2 border-[#ede9e1] flex items-center justify-center text-[#64748b] font-extrabold text-xs">
                      +{members.length - 18}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
