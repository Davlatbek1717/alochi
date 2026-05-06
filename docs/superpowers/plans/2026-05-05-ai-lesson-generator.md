# Phase 14 — AI Lesson Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filadmin dars mavzusini kiritadi → AI vocabulary + MCQ savollar + tutor kontekst generatsiya qiladi → forma avtomatik to'ldiriladi va dars saqlanganda komponentlar ham yoziladi.

**Architecture:** New `AiService.generateLessonContent(topic)` method sends a structured Gemini prompt requesting JSON output. A new `POST /ai/generate-lesson` endpoint exposes it. The `/filadmin/lessons/new` page gets an AI button that calls the endpoint, shows a preview panel, and on "Qabul qilish" stores the AI result in local state so that after `POST /lessons` succeeds, the page also posts to `/lessons/:id/mcq` and `/lessons/:id/vocabulary`.

**Tech Stack:** Google Gemini 2.5 Flash (existing `@google/genai`), NestJS, React `useState`, existing `apiRequest` helper

---

## File Map

| File | Change |
|---|---|
| `apps/api/src/ai/ai.service.ts` | add `generateLessonContent(topic)` |
| `apps/api/src/ai/ai.controller.ts` | add `POST /ai/generate-lesson` |
| `apps/api/src/ai/ai.spec.ts` (new) | unit test for `generateLessonContent` |
| `apps/web/app/[locale]/(dashboard)/filadmin/lessons/new/page.tsx` | AI button + preview + post components |

---

## Task 1: Backend — `generateLessonContent` + endpoint + test

**Files:**
- Modify: `apps/api/src/ai/ai.service.ts`
- Modify: `apps/api/src/ai/ai.controller.ts`
- Create: `apps/api/src/ai/ai.spec.ts`

### Step-by-step

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/ai/ai.spec.ts`:

```typescript
import { AiService } from './ai.service';

interface MockGenAI {
  models: { generateContent: jest.Mock };
}

describe('AiService — generateLessonContent', () => {
  let svc: AiService;
  let mockGenAI: MockGenAI;

  beforeEach(() => {
    mockGenAI = {
      models: { generateContent: jest.fn() },
    };
    svc = new AiService(
      {} as any,        // HttpService (not used by this method)
      {} as any,        // ConfigService (key already set on genai)
      {} as any,        // PrismaService (not used)
      {} as any,        // StatusService (not used)
    );
    (svc as any).genai = mockGenAI;
    (svc as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  it('parses valid JSON response from Gemini', async () => {
    const payload = {
      aiTutorContext: 'Bu dars Present Simple mavzusida.',
      vocabulary: [{ word: 'run', translation: 'yugurmoq', example: 'I run every day.' }],
      mcqQuestions: [{ question: 'Which is correct?', options: ['a', 'b', 'c', 'd'], correctIndex: 1 }],
    };
    mockGenAI.models.generateContent.mockResolvedValue({ text: JSON.stringify(payload) });

    const result = await svc.generateLessonContent('Present Simple');

    expect(result.aiTutorContext).toBe('Bu dars Present Simple mavzusida.');
    expect(result.vocabulary).toHaveLength(1);
    expect(result.vocabulary[0].word).toBe('run');
    expect(result.mcqQuestions).toHaveLength(1);
    expect(result.mcqQuestions[0].correctIndex).toBe(1);
  });

  it('strips markdown code fences from Gemini response if present', async () => {
    const payload = {
      aiTutorContext: 'ctx',
      vocabulary: [],
      mcqQuestions: [],
    };
    const withFences = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    mockGenAI.models.generateContent.mockResolvedValue({ text: withFences });

    const result = await svc.generateLessonContent('Colors');
    expect(result.aiTutorContext).toBe('ctx');
  });

  it('throws ServiceUnavailableException when Gemini fails', async () => {
    mockGenAI.models.generateContent.mockRejectedValue(new Error('quota'));

    await expect(svc.generateLessonContent('Animals'))
      .rejects.toThrow('AI servis');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter api exec jest --testPathPattern="ai.spec"
```

Expected: FAIL — `svc.generateLessonContent is not a function`

- [ ] **Step 3: Add `generateLessonContent` to `AiService`**

Open `apps/api/src/ai/ai.service.ts`. After the existing `askTutor` method, add:

```typescript
/**
 * Generate lesson content (vocabulary + MCQ + tutor context) for a given topic.
 * Called by filadmin when creating a new lesson.
 *
 * Returns structured JSON that the frontend uses to pre-fill the lesson form
 * and auto-create vocabulary and MCQ components on save.
 */
async generateLessonContent(topic: string): Promise<{
  aiTutorContext: string;
  vocabulary: Array<{ word: string; translation: string; example: string }>;
  mcqQuestions: Array<{ question: string; options: string[]; correctIndex: number }>;
}> {
  const prompt = `You are an English language teacher creating lesson materials for Uzbek students in grades 3-7.
Topic: "${topic}"

Generate the following in valid JSON format with NO extra text:
{
  "aiTutorContext": "<3-5 sentences in Uzbek describing this topic for an AI tutor>",
  "vocabulary": [
    { "word": "<English word>", "translation": "<Uzbek translation>", "example": "<simple English sentence>" }
  ],
  "mcqQuestions": [
    { "question": "<English question>", "options": ["<opt A>","<opt B>","<opt C>","<opt D>"], "correctIndex": <0-3> }
  ]
}

Rules:
- vocabulary: exactly 8-10 items
- mcqQuestions: exactly 10 items
- correctIndex: integer 0-3
- Return ONLY the JSON object, no markdown fences, no explanation`;

  try {
    const response = await withRetry(() =>
      this.genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.4, maxOutputTokens: 2000 },
      }),
    );

    // Strip markdown code fences if Gemini wraps the JSON anyway
    const raw = (response.text ?? '').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    const parsed = JSON.parse(raw) as {
      aiTutorContext: string;
      vocabulary: Array<{ word: string; translation: string; example: string }>;
      mcqQuestions: Array<{ question: string; options: string[]; correctIndex: number }>;
    };

    return {
      aiTutorContext: parsed.aiTutorContext ?? '',
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      mcqQuestions: Array.isArray(parsed.mcqQuestions) ? parsed.mcqQuestions : [],
    };
  } catch (err) {
    this.logger.error(`generateLessonContent failed: ${(err as Error).message}`);
    throw new ServiceUnavailableException('AI servis dars kontentini generatsiya qila olmadi');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter api exec jest --testPathPattern="ai.spec"
```

Expected: 3 tests PASS

- [ ] **Step 5: Add `POST /ai/generate-lesson` to `AiController`**

Open `apps/api/src/ai/ai.controller.ts`. Add `BadRequestException` to NestJS imports if not already present. Add this endpoint after any existing endpoint (not inside a method):

```typescript
import { Throttle } from '@nestjs/throttler';

@Post('generate-lesson')
@Roles(UserRole.superadmin, UserRole.filadmin)
@Throttle({ default: { ttl: 60_000, limit: 5 } })
generateLesson(@Body('topic') topic: string) {
  if (!topic?.trim()) {
    throw new BadRequestException('Mavzu kiritilmagan');
  }
  return this.ai.generateLessonContent(topic.trim().slice(0, 200));
}
```

Also add `BadRequestException` to the existing NestJS import at the top if it's missing.

- [ ] **Step 6: Typecheck + full tests**

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter api exec jest
```

Expected: 0 errors, all suites pass (was 418 before this task).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ai/ai.service.ts apps/api/src/ai/ai.controller.ts apps/api/src/ai/ai.spec.ts
git commit -m "feat(ai): generateLessonContent — Gemini JSON prompt for vocabulary+MCQ+context + POST /ai/generate-lesson"
```

---

## Task 2: Frontend — AI button + preview panel + component posting

**Files:**
- Modify: `apps/web/app/[locale]/(dashboard)/filadmin/lessons/new/page.tsx`

The page already has the lesson creation form with `title`, `type`, `orderNumber`, `youtubeUrl`, `aiTutorContext` fields and a `handleSubmit` that POSTs to `/lessons`.

- [ ] **Step 1: Add types and AI state**

Open `apps/web/app/[locale]/(dashboard)/filadmin/lessons/new/page.tsx`. After the existing `import` block, add the AI result type:

```typescript
interface AiLessonResult {
  aiTutorContext: string;
  vocabulary: Array<{ word: string; translation: string; example: string }>;
  mcqQuestions: Array<{ question: string; options: string[]; correctIndex: number }>;
}
```

Inside the `FiladminNewLessonPage` component, after existing state declarations, add:

```typescript
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<AiLessonResult | null>(null);
const [aiApplied, setAiApplied] = useState(false);
```

- [ ] **Step 2: Add `handleAiGenerate` function**

Inside the component, before `handleSubmit`, add:

```typescript
async function handleAiGenerate() {
  const topic = form.title.trim();
  if (!topic) {
    toast.error('Avval dars sarlavhasini kiriting');
    return;
  }
  setAiLoading(true);
  setAiResult(null);
  setAiApplied(false);
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const res = await apiRequest<AiLessonResult>(
      '/ai/generate-lesson',
      { method: 'POST', body: JSON.stringify({ topic }) },
      token,
    );
    setAiResult(res.data);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'AI xatolik');
  } finally {
    setAiLoading(false);
  }
}

function handleApplyAi() {
  if (!aiResult) return;
  setForm((prev) => ({ ...prev, aiTutorContext: aiResult.aiTutorContext, aiTutorEnabled: true }));
  setAiApplied(true);
}
```

- [ ] **Step 3: Update `handleSubmit` to post vocabulary + MCQ after lesson creation**

In `handleSubmit`, find this section (after lesson is created):

```typescript
      toast.success("Dars yaratildi — endi topshiriq qo'shing");
      router.push(`/filadmin/lessons/${res.data.id}`);
```

Replace with:

```typescript
      const lessonId = res.data.id;

      // Auto-post AI-generated vocabulary and MCQ if the user applied them
      if (aiApplied && aiResult) {
        try {
          // Map AI vocabulary to {english, uzbek} format for ComponentsService
          const vocabWords = aiResult.vocabulary.map((v) => ({
            english: v.word,
            uzbek: v.translation,
          }));
          await apiRequest(
            `/lessons/${lessonId}/vocabulary`,
            { method: 'POST', body: JSON.stringify({ words: vocabWords }) },
            token,
          );

          // Map AI MCQ to {text, options, correct} format for ComponentsService
          const mcqQuestions = aiResult.mcqQuestions.map((q) => ({
            text: q.question,
            options: q.options,
            correct: q.correctIndex,
          }));
          await apiRequest(
            `/lessons/${lessonId}/mcq`,
            { method: 'POST', body: JSON.stringify({ questions: mcqQuestions }) },
            token,
          );
        } catch {
          // Non-fatal: lesson created, components failed. Toast warns but navigates.
          toast.error("Dars yaratildi lekin AI komponentlar qo'shilmadi — qayta urinib ko'ring");
        }
      }

      toast.success("Dars yaratildi — endi topshiriq qo'shing");
      router.push(`/filadmin/lessons/${lessonId}`);
```

- [ ] **Step 4: Add the AI button to the form JSX**

Find where `aiTutorContext` textarea is rendered in the JSX. Just ABOVE the `aiTutorContext` label/textarea block, add the AI generate button and preview panel:

```tsx
{/* ── AI Content Generator ─────────────────────────────────────── */}
<div className="space-y-3">
  <button
    type="button"
    onClick={handleAiGenerate}
    disabled={aiLoading || !form.title.trim()}
    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d9488] text-white text-sm font-bold hover:bg-[#0f766e] disabled:opacity-40 transition-colors"
  >
    {aiLoading ? (
      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    ) : (
      <Sparkles size={15} />
    )}
    {aiLoading ? 'Generatsiya qilinmoqda...' : '🤖 AI bilan to\'ldirish'}
  </button>

  {aiResult && !aiApplied && (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
      <p className="text-xs font-extrabold text-teal-800 uppercase tracking-widest">
        AI yaratdi
      </p>
      <ul className="space-y-1 text-xs text-teal-700 font-semibold">
        <li>✅ AI Tutor kontekst: "{aiResult.aiTutorContext.slice(0, 60)}..."</li>
        <li>✅ Vocabulary: {aiResult.vocabulary.length} ta so&apos;z ({aiResult.vocabulary.slice(0, 3).map((v) => v.word).join(', ')}...)</li>
        <li>✅ MCQ: {aiResult.mcqQuestions.length} ta savol</li>
      </ul>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleApplyAi}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors"
        >
          <CheckSquare size={12} /> Qabul qilish
        </button>
        <button
          type="button"
          onClick={handleAiGenerate}
          disabled={aiLoading}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-teal-700 hover:bg-teal-100 transition-colors"
        >
          🔄 Qayta
        </button>
        <button
          type="button"
          onClick={() => setAiResult(null)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#64748b] hover:bg-[#f3eedf] transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )}

  {aiApplied && (
    <div className="flex items-center gap-2 text-xs font-bold text-teal-700 bg-teal-50 px-3 py-2 rounded-xl border border-teal-200">
      <CheckSquare size={13} />
      AI yaratgan kontent qabul qilindi — darsni saqlashda komponentlar ham yoziladi
    </div>
  )}
</div>
```

Note: `CheckSquare` and `Sparkles` are already imported at the top of the page — verify they exist in the import block. If `CheckSquare` is missing, add it to the lucide-react import.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Full quality gates**

```bash
pnpm --filter api exec jest
pnpm run build
```

Expected: all suites pass, build clean.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/[locale]/(dashboard)/filadmin/lessons/new/page.tsx"
git commit -m "feat(ai): AI lesson generator UI — topic → preview → apply → auto-post vocabulary+MCQ"
```

---

## Self-Review ✅

**Spec coverage:**
- [x] `generateLessonContent(topic)` in AiService — Task 1
- [x] Gemini JSON prompt with vocabulary + MCQ + tutor context — Task 1
- [x] Response format: `{ aiTutorContext, vocabulary[], mcqQuestions[] }` — Task 1
- [x] `POST /ai/generate-lesson` with rate limiting (5/min) — Task 1
- [x] "AI bilan to'ldirish" button in new lesson form — Task 2
- [x] Preview panel with accept/retry/dismiss — Task 2
- [x] `handleApplyAi` fills `aiTutorContext` textarea — Task 2
- [x] On save: auto-posts vocabulary (`/lessons/:id/vocabulary`) — Task 2
- [x] On save: auto-posts MCQ (`/lessons/:id/mcq`) — Task 2
- [x] Data format mapping: AI `{ word, translation }` → API `{ english, uzbek }` — Task 2
- [x] Data format mapping: AI `{ question, options, correctIndex }` → API `{ text, options, correct }` — Task 2
- [x] Max 200 char topic input guard — Task 1
- [x] Error handling: Gemini fallback → ServiceUnavailableException — Task 1
- [x] Non-fatal component posting failure (lesson created, toast warns) — Task 2

**Placeholder scan:** None. ✅

**Type consistency:**
- `AiLessonResult` defined once, used in state + handleApplyAi + handleSubmit ✅
- `generateLessonContent` return type matches `AiLessonResult` interface ✅
- MCQ format mapping: `{ correctIndex }` (AI) → `{ correct }` (API) — consistent throughout ✅
