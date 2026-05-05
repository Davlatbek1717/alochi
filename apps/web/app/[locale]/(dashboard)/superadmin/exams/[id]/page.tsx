'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, useToast } from '@/components/ui';
import { ExamEditor, type ExamPayload } from '../_components/ExamEditor';

interface ExamFromApi {
  id: string;
  title: string;
  description: string | null;
  kind: 'test' | 'ai_oral';
  language: 'uz' | 'en' | null;
  aiPrompt: string | null;
  maxMinutes: number | null;
  passThreshold: number;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  questions: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
    orderIndex: number;
  }>;
}

export default function EditExamPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [initial, setInitial] = useState<ExamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ExamFromApi>(`/exams/admin/${id}`, {}, token)
      .then((res) => {
        const exam = res.data;
        setInitial({
          title: exam.title,
          description: exam.description ?? '',
          kind: (exam.kind ?? 'test') as 'test' | 'ai_oral',
          language: (exam.language ?? 'en') as 'uz' | 'en',
          aiPrompt: exam.aiPrompt ?? '',
          maxMinutes: exam.maxMinutes ?? 10,
          passThreshold: exam.passThreshold,
          timeLimitMinutes: exam.timeLimitMinutes,
          isPublished: exam.isPublished,
          questions: exam.questions
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((q) => ({
              id: q.id,
              type: q.type,
              config: q.config ?? {},
              orderIndex: q.orderIndex,
            })),
        });
      })
      .catch((e: unknown) => {
        setNotFound(true);
        toast.error(e instanceof Error ? e.message : 'Yuklab boʻlmadi');
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-full bg-[#f7f4ef] p-4 md:p-6 space-y-4">
        <Skeleton theme="light" className="h-6 w-32" />
        <Skeleton theme="light" className="h-8 w-64" />
        <Skeleton theme="light" className="h-32 w-full rounded-2xl" />
        <Skeleton theme="light" className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (notFound || !initial) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <Link
            href="/superadmin/exams"
            className="flex items-center gap-2 text-[#94a3b8] text-sm hover:text-white transition-colors w-fit"
          >
            <ArrowLeft size={16} /> Imtihonlar
          </Link>
        </div>
        <div className="p-6">
          <EmptyState
            theme="light"
            icon={<GraduationCap size={28} />}
            title="Imtihon topilmadi"
            description="Bunday ID li imtihon mavjud emas yoki o'chirilgan"
          />
        </div>
      </div>
    );
  }

  return <ExamEditor examId={id} initial={initial} />;
}
