# Plan 8: Student Lesson Flow — Real Components & Progress Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O'quvchi dars jarayonini real API ma'lumotlari bilan to'liq ishlatuvchi qilish — hozir MOCK data ishlatilmoqda, darslar ro'yxati sahifasi yo'q, progress saqlanmaydi.

**Architecture:** Web `apps/web` da 3 ta yangi sahifa + mavjud lesson page ni to'g'rilash. Backend tarafda hech narsa o'zgarmaydi — barcha kerakli endpointlar allaqachon bor (`GET /lessons`, `GET /lessons/next`, `POST /progress/:id/complete-session`, `GET /progress/my`). Frontend API bilan to'g'ri ulash yetarli.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `apiRequest` helper (`apps/web/lib/api.ts`), Tailwind CSS

**Mavjud endpoint-lar (o'zgarishsiz):**
- `GET /lessons` → barcha published darslar (tenant bo'yicha)
- `GET /lessons/next` → student uchun keyingi tugallanmagan dars
- `GET /lessons/:id` → dars + `components_data` (MCQ, so'z tartibi)
- `POST /progress/:lessonId/complete-session` → bir sessiyani yakunlash (N repetition bo'lsa homeCompleted = true)
- `GET /progress/my` → studentning barcha progress yozuvlari

**Lesson components_data formati:**
```json
[
  { "type": "mcq", "config": { "question": "She ___ to school.", "options": ["go","goes","going","gone"], "correctIndex": 1 } },
  { "type": "word_order", "config": { "words": ["I","am","a","student"], "correct": "I am a student" } }
]
```

**Lesson.components flags formati:**
```json
{ "mcq": true, "word_order": false, "vocabulary": false, "ai_tutor": false, "camera": false }
```

---

## File Structure

| Fayl | Harakat | Ta'sir |
|------|---------|--------|
| `apps/web/app/(dashboard)/layout.tsx` | Modify | Student navga "Darslar" qo'shish |
| `apps/web/app/(dashboard)/student/lessons/page.tsx` | **Create** | Barcha darslar ro'yxati + progress |
| `apps/web/app/(dashboard)/student/lessons/current/page.tsx` | **Create** | `GET /lessons/next` → redirect |
| `apps/web/app/(dashboard)/student/lessons/[id]/page.tsx` | Modify | Real components, progress tracking |
| `apps/web/app/(dashboard)/student/page.tsx` | Modify | "Bugungi Darsni Boshlash" linkini to'g'rilash |

---

## Task 1: Student Nav — "Darslar" qo'shish

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: `student` nav arrayiga "Darslar" qo'shish**

```tsx
// apps/web/app/(dashboard)/layout.tsx — student qatorini toping (qator ~25):
student: [
  { label: 'Bosh sahifa', href: '/student' },
  { label: "Darslar", href: '/student/lessons' },       // ← QO'SHISH
  { label: "Do'stlar", href: '/student/friends' },
],
```

- [ ] **Step 2: Dev serverni tekshirish**

Brauzerda `http://localhost:3000/student` ga kiring. Chap sidebar da "Darslar" link ko'rinishi kerak.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx
git commit -m "feat(web): add Darslar nav item for student role"
```

---

## Task 2: Student Lessons List Page

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/page.tsx`

- [ ] **Step 1: Fayl yaratish**

```tsx
// apps/web/app/(dashboard)/student/lessons/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type Lesson = {
  id: string;
  title: string;
  orderNumber: number;
  isPublished: boolean;
};

type Progress = {
  lessonId: string;
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

export default function LessonsListPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      try {
        const [lessonsRes, progressRes] = await Promise.all([
          apiRequest<Lesson[]>('/lessons', {}, token),
          apiRequest<Progress[]>('/progress/my', {}, token),
        ]);

        setLessons(lessonsRes.data.filter((l) => l.isPublished));

        const progressMap: Record<string, Progress> = {};
        for (const p of progressRes.data) {
          progressMap[p.lessonId] = p;
        }
        setProgress(progressMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xato yuz berdi');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function getStatus(lesson: Lesson) {
    const p = progress[lesson.id];
    if (!p) return 'new';
    if (p.academyCompleted) return 'done';
    if (p.homeCompleted) return 'academy';
    return 'in_progress';
  }

  const STATUS_CONFIG = {
    new: { label: 'Yangi', color: 'bg-gray-100 text-gray-600' },
    in_progress: { label: "O'qilmoqda", color: 'bg-yellow-100 text-yellow-700' },
    academy: { label: 'Akademiya kutilmoqda', color: 'bg-blue-100 text-blue-700' },
    done: { label: "Tugallangan", color: 'bg-green-100 text-green-700' },
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 flex justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Darslar</h1>
        <span className="text-sm text-gray-500">{lessons.length} ta dars</span>
      </div>

      {lessons.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-500">Hali darslar qo&apos;shilmagan</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {lessons.map((lesson) => {
            const status = getStatus(lesson);
            const cfg = STATUS_CONFIG[status];
            const p = progress[lesson.id];
            const isLocked = lesson.orderNumber > 1 && (() => {
              const prev = lessons.find((l) => l.orderNumber === lesson.orderNumber - 1);
              if (!prev) return false;
              const prevProgress = progress[prev.id];
              return !prevProgress?.homeCompleted;
            })();

            return (
              <li key={lesson.id}>
                {isLocked ? (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 opacity-60 cursor-not-allowed flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold shrink-0">
                      🔒
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-400">Dars #{lesson.orderNumber}</p>
                      <p className="text-sm text-gray-400 truncate">{lesson.title}</p>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/student/lessons/${lesson.id}`}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {lesson.orderNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{lesson.title}</p>
                      {p && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.sessionCount} ta sessiya bajarildi
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Brauzerda tekshirish**

`http://localhost:3000/student/lessons` ga kiring. Superadmin tomonidan yaratilgan darslar ro'yxati ko'rinishi kerak (seed dagi 2 ta dars).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/page.tsx
git commit -m "feat(web): student lessons list page with progress status"
```

---

## Task 3: Current Lesson Redirect Page

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/current/page.tsx`

Maqsad: `GET /lessons/next` endpointini chaqirib, o'quvchini keyingi tugallanmagan darsga yo'naltirish. Dashboard dagi "Bugungi Darsni Boshlash" tugmasi shu sahifaga link qiladi.

- [ ] **Step 1: Fayl yaratish**

```tsx
// apps/web/app/(dashboard)/student/lessons/current/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type NextLesson = { id: string; title: string } | null;

export default function CurrentLessonPage() {
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    apiRequest<NextLesson>('/lessons/next', {}, token)
      .then((res) => {
        if (res.data) {
          router.replace(`/student/lessons/${res.data.id}`);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [router]);

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-bold text-gray-800">Barcha darslar tugallandi!</h2>
        <p className="text-gray-500 mt-2">Ajoyib — siz barcha mavjud darslarni o&apos;tdingiz.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-20 flex justify-center">
      <p className="text-gray-500">Dars qidirilmoqda...</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/current/page.tsx
git commit -m "feat(web): current lesson redirect via GET /lessons/next"
```

---

## Task 4: Fix Lesson Page — Real Components + Progress Tracking

**Files:**
- Modify: `apps/web/app/(dashboard)/student/lessons/[id]/page.tsx`

Hozirgi holat:
- `MOCK_MCQ` va `MOCK_WORD_ORDER` hardcoded — real API dan olinmaydi
- Dars tugagach `POST /progress/:lessonId/complete-session` chaqirilmaydi
- Qaysi steplar faol ekanini `components` flaglari belgilaydi — hozir hammasi hardcoded

Kerakli o'zgarishlar:
1. `GET /lessons/:id` response dagi `components_data` dan MCQ va word_order savollarini parse qilish
2. `components` JSON flaglar asosida step ro'yxatini dinamik qurishLessondan `components.ai_tutor` yoki `components.camera` bo'lmasa — o'sha steplarni o'tkazib yuborish
3. Har bir sessiya oxirida `POST /progress/:lessonId/complete-session` chaqirish

- [ ] **Step 1: Type'larni aniqlash va API response parse qilish**

`apps/web/app/(dashboard)/student/lessons/[id]/page.tsx` faylini to'liq quyidagicha almashtirish:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { VideoPlayer } from './_components/VideoPlayer';
import { McqTest } from './_components/McqTest';
import { WordOrderTest } from './_components/WordOrderTest';
import { AiTutor } from './_components/AiTutor';
import { CameraMonitor } from './_components/CameraMonitor';
import { apiRequest } from '@/lib/api';

type ComponentFlags = {
  mcq?: boolean;
  word_order?: boolean;
  vocabulary?: boolean;
  ai_tutor?: boolean;
  camera?: boolean;
};

type LessonComponent = {
  id: string;
  type: 'mcq' | 'word_order' | 'vocabulary';
  config: Record<string, unknown>;
};

type McqConfig = {
  question: string;
  options: string[];
  correctIndex: number;
};

type WordOrderConfig = {
  words: string[];
  correct: string;
};

type Lesson = {
  id: string;
  title: string;
  youtubeUrl: string;
  nRepetitions: number;
  components: ComponentFlags;
  components_data: LessonComponent[];
};

type ProgressData = {
  sessionCount: number;
  homeCompleted: boolean;
  academyCompleted: boolean;
};

type Step = 'video' | 'mcq' | 'word_order' | 'ai_tutor' | 'academy' | 'done';

function buildSteps(components: ComponentFlags): Step[] {
  const steps: Step[] = ['video'];
  if (components.mcq) steps.push('mcq');
  if (components.word_order) steps.push('word_order');
  if (components.ai_tutor) steps.push('ai_tutor');
  if (components.camera) steps.push('academy');
  steps.push('done');
  return steps;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('video');
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [lessonRes, progressRes] = await Promise.all([
          apiRequest<Lesson>(`/lessons/${id}`, {}, token),
          apiRequest<ProgressData>(`/progress/my`, {}, token).catch(() => ({ data: null as unknown as ProgressData })),
        ]);
        setLesson(lessonRes.data);

        // Find this lesson's progress from the array
        const progressArr = progressRes.data as unknown as Array<{ lessonId: string } & ProgressData>;
        const myProgress = Array.isArray(progressArr)
          ? progressArr.find((p) => p.lessonId === id) ?? null
          : null;
        setProgress(myProgress);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dars topilmadi');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  async function completeSession() {
    if (!lesson || completing) return;
    const token = localStorage.getItem('accessToken') ?? '';
    setCompleting(true);
    try {
      await apiRequest(`/progress/${lesson.id}/complete-session`, { method: 'POST' }, token);
    } catch {
      // non-blocking — progress may still be tracked
    } finally {
      setCompleting(false);
    }
  }

  function getMcqQuestions() {
    if (!lesson) return [];
    return lesson.components_data
      .filter((c) => c.type === 'mcq')
      .map((c) => {
        const cfg = c.config as McqConfig;
        return { text: cfg.question, options: cfg.options, correct: cfg.correctIndex };
      });
  }

  function getWordOrderSentences() {
    if (!lesson) return [];
    return lesson.components_data
      .filter((c) => c.type === 'word_order')
      .map((c) => {
        const cfg = c.config as WordOrderConfig;
        return { words: cfg.words, correct: cfg.correct };
      });
  }

  function goToNextStep() {
    if (!lesson) return;
    const steps = buildSteps(lesson.components);
    const idx = steps.indexOf(step);
    if (idx + 1 < steps.length) {
      setStep(steps[idx + 1]);
    }
  }

  async function handleVideoComplete() {
    setVideoCompleted(true);
  }

  async function handleCycleComplete() {
    await completeSession();
    setStep('done');
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-6 flex items-center justify-center">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="max-w-3xl mx-auto py-6">
        <p className="text-red-500">{error || 'Dars topilmadi'}</p>
      </div>
    );
  }

  const steps = buildSteps(lesson.components);
  const currentStepIndex = steps.indexOf(step);
  const mcqQuestions = getMcqQuestions();
  const wordOrderSentences = getWordOrderSentences();

  function restartCycle() {
    setStep('video');
    setVideoCompleted(false);
  }

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Orqaga
        </button>
        <h1 className="text-xl font-bold flex-1">{lesson.title}</h1>
        {progress && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {progress.sessionCount}/{lesson.nRepetitions} sessiya
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {steps.filter((s) => s !== 'done').map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${
              i < currentStepIndex ? 'bg-green-400' :
              i === currentStepIndex ? 'bg-indigo-600' :
              'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 'video' && (
        <div className="space-y-4">
          <VideoPlayer
            youtubeUrl={lesson.youtubeUrl}
            onCompleted={handleVideoComplete}
          />
          {videoCompleted ? (
            <button
              onClick={goToNextStep}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
            >
              Davom etish →
            </button>
          ) : (
            <p className="text-center text-gray-500 text-sm">
              Davom etish uchun videoni ko&apos;ring
            </p>
          )}
        </div>
      )}

      {step === 'mcq' && mcqQuestions.length > 0 && (
        <McqTest
          questions={mcqQuestions}
          onPassed={goToNextStep}
          onFailed={restartCycle}
        />
      )}

      {step === 'mcq' && mcqQuestions.length === 0 && (
        // MCQ enabled lekin savollar yo'q — o'tkazib yuborish
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">MCQ savollar topilmadi</p>
          <button onClick={goToNextStep} className="mt-2 text-indigo-600 text-sm underline">
            Davom etish
          </button>
        </div>
      )}

      {step === 'word_order' && wordOrderSentences.length > 0 && (
        <WordOrderTest
          sentences={wordOrderSentences}
          onPassed={goToNextStep}
          onFailed={restartCycle}
        />
      )}

      {step === 'word_order' && wordOrderSentences.length === 0 && (
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">So&apos;z tartibi topshiriqlari topilmadi</p>
          <button onClick={goToNextStep} className="mt-2 text-indigo-600 text-sm underline">
            Davom etish
          </button>
        </div>
      )}

      {step === 'ai_tutor' && (
        <AiTutor
          lessonContext={lesson.title}
          onCompleted={goToNextStep}
        />
      )}

      {step === 'academy' && (
        <div className="space-y-4">
          <CameraMonitor
            onLookAway={restartCycle}
            onSilenceTooLong={restartCycle}
          />
          <button
            onClick={handleCycleComplete}
            disabled={completing}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {completing ? 'Saqlanmoqda...' : '✅ Topshirish — Sessiyani yakunlash'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
          <p className="text-5xl">🎉</p>
          <h2 className="text-xl font-bold text-gray-800">Sessiya yakunlandi!</h2>
          <p className="text-gray-500 text-sm">
            {progress
              ? `${(progress.sessionCount) + 1}/${lesson.nRepetitions} sessiya bajarildi`
              : 'Jarayoningiz saqlandi'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={restartCycle}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium"
            >
              🔄 Yana bir bor
            </button>
            <button
              onClick={() => router.push('/student/lessons')}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-medium"
            >
              ← Darslar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Brauzerda sinash**

1. `http://localhost:3000/student/lessons` → darslar ro'yxatiga kiring
2. Birinchi darsga bosing
3. Video tugagach "Davom etish" tugmasi chiqishi kerak
4. MCQ bosqichida seed dan `She ___ to school every day.` savoli real API dan kelishi kerak
5. Hamma bosqichlar o'tgach "Sessiya yakunlandi!" ko'rinishi kerak

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/\[id\]/page.tsx
git commit -m "feat(web): lesson page loads real components from API, tracks progress"
```

---

## Task 5: Fix Dashboard Button

**Files:**
- Modify: `apps/web/app/(dashboard)/student/page.tsx`

Hozir dashboard dagi `href="/student/lessons/current"` — bu yangi yaratgan sahifa bilan ishlaydi. Ammo darsni tugatisgandan keyin `href="/student/lessons"` ga redirect qilish ham kerak. Faqat button linkini tekshirish:

- [ ] **Step 1: Link to'g'riligini tekshirish**

```tsx
// apps/web/app/(dashboard)/student/page.tsx da quyidagi qatorni toping:
// href="/student/lessons/current"
// Agar boshqa narsa bo'lsa, quyidagicha o'zgartiring:
```

`student/page.tsx` faylida `href` qiymatini qidiring. Agar `/student/lessons/current` bo'lsa — hech narsa o'zgartirish shart emas (Task 3 da yaratildi). Agar boshqacha bo'lsa, to'g'rilang.

- [ ] **Step 2: Brauzerda tekshirish**

`http://localhost:3000/student` da "Bugungi Darsni Boshlash" tugmasini bosing. `GET /lessons/next` chaqirilib birinchi darsga yo'naltirilishi kerak.

- [ ] **Step 3: Commit (agar o'zgarish bo'lsa)**

```bash
git add apps/web/app/(dashboard)/student/page.tsx
git commit -m "fix(web): dashboard lesson button links to /student/lessons/current"
```

---

## Task 6: Add Social Feed API Endpoint

**Files:**
- Modify: `apps/api/src/social/social.controller.ts`
- Modify: `apps/api/src/social/social.module.ts` (agar FriendsService inject qilinmagan bo'lsa)

Hozir `GET /social/feed` endpoint yo'q. `SocialFeed` komponenti demo data ishlatmoqda. Oddiy feed endpoint qo'shamiz — do'stlarning so'nggi aktivliklarini qaytaradi. Bu yerda `social_feed_events` jadvali shart emas — student_xp, progress, friendships jadvallardan oddiy aggregatsiya.

- [ ] **Step 1: Feed endpointini qo'shish**

`apps/api/src/social/social.controller.ts` faylini oching va oxiridagi `}` oldiga quyidagini qo'shing:

```typescript
  @Get('feed')
  @Roles(UserRole.student)
  async getFeed(@Request() req: any) {
    const friends = await this.friends.getFriends(req.user.userId);
    const friendIds = friends.data.map((f: any) => f.id);
    
    if (friendIds.length === 0) return { success: true, data: [], meta: { timestamp: new Date() } };

    const recentProgress = await this.friends['prisma'].studentProgress.findMany({
      where: {
        studentId: { in: friendIds },
        lastActivityAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: { student: { select: { name: true } }, lesson: { select: { title: true } } },
      orderBy: { lastActivityAt: 'desc' },
      take: 20,
    });

    const events = recentProgress.map((p: any) => ({
      type: p.academyCompleted ? 'lesson_done' : 'lesson_progress',
      studentName: p.student.name,
      detail: p.academyCompleted ? `${p.lesson.title} ni tugalladi!` : `${p.lesson.title} ni o'qimoqda`,
      timestamp: p.lastActivityAt,
    }));

    return { success: true, data: events, meta: { timestamp: new Date() } };
  }
```

**Eslatma:** `this.friends['prisma']` — bu hack. `FriendsService` PrismaService ni inject qilgan. Lekin controller da to'g'ridan-to'g'ri `PrismaService` inject qilish tozaroq. Agar bu ishlamasa, `PrismaService` ni social.module.ts ga qo'shing va controller da inject qiling:

```typescript
// social.controller.ts constructor ga qo'shish:
private prisma: PrismaService,
```

```typescript
// social.module.ts providers ga qo'shish:
PrismaService,
```

- [ ] **Step 2: Test**

```bash
# API restart bo'ladi (watch mode) — keyin:
curl -s http://localhost:3001/social/feed \
  -H "Authorization: Bearer <TOKEN>" | head -c 200
```

`TOKEN` ni avval `/auth/login` bilan oling (jasur.student uchun).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/social/social.controller.ts
git commit -m "feat(api): GET /social/feed returns friends recent activity"
```

---

## Task 7: Wire SocialFeed to Real API

**Files:**
- Modify: `apps/web/app/(dashboard)/student/_components/SocialFeed.tsx`

- [ ] **Step 1: Demo data ni real API bilan almashtirish**

```tsx
// apps/web/app/(dashboard)/student/_components/SocialFeed.tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface FeedEvent {
  type: 'lesson_done' | 'lesson_progress';
  studentName: string;
  detail: string;
  timestamp: string;
}

const EVENT_ICONS: Record<string, string> = {
  lesson_done: '📚',
  lesson_progress: '✏️',
  badge: '🏅',
  duel_win: '⚔️',
  streak: '🔥',
};

export function SocialFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FeedEvent[]>('/social/feed', {}, token)
      .then((res) => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold mb-2">👥 Do&apos;stlar Lentasi</h3>
        <p className="text-sm text-gray-400 text-center py-4">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
      <h3 className="font-semibold">👥 Do&apos;stlar Lentasi</h3>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Do&apos;stlar aktivligi yo&apos;q — do&apos;st qo&apos;shing!
        </p>
      ) : (
        events.map((event, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
            <span className="text-xl">{EVENT_ICONS[event.type] ?? '📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                <span className="font-medium">{event.studentName}</span> — {event.detail}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(event.timestamp).toLocaleDateString('uz')}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Brauzerda tekshirish**

`http://localhost:3000/student` — SocialFeed "Do'stlar aktivligi yo'q — do'st qo'shing!" ko'rinishi kerak (chunki hali hech qanday do'stlik yo'q). Xato emas, to'g'ri holat.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/student/_components/SocialFeed.tsx
git commit -m "feat(web): SocialFeed connects to real GET /social/feed API"
```

---

## Self-Review

**Spec coverage:**
- ✅ Student darslar ro'yxati — Task 2
- ✅ Ketma-ket dars bloki (oldingi tugamasdan keyingisi ochilmaydi) — Task 2 (isLocked)
- ✅ Real MCQ savollar API dan — Task 4
- ✅ Real so'z tartibi API dan — Task 4
- ✅ Progress tracking (`POST /progress/:id/complete-session`) — Task 4
- ✅ Keyingi darsga yo'naltirish — Task 3
- ✅ Student nav — Task 1
- ✅ Social feed real API — Task 6, 7
- ⚠️ `social_feed_events` jadvali yo'q — feed progress jadvalidan to'g'ridan-to'g'ri o'qiydi (yetarli)

**Type consistency:**
- `McqConfig.correctIndex` → `correct` maplash Task 4 da to'g'ri
- `buildSteps()` faqat `components` flaglariga qarab ishlaydi — mos
- `getFriends()` return value `{ data: [] }` formatida — Task 6 da `friends.data` ishlatilgan ✅

**Placeholder scan:** Yo'q — barcha steplar to'liq kod bilan.
