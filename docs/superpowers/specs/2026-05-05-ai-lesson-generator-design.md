# Phase 14 — AI Dars Yaratish Assistenti Dizayni

**Sana:** 2026-05-05
**Muallif:** Davlatbek + Claude
**Holat:** Tasdiqlangan ✅

---

## Maqsad

Filadmin dars mavzusini kiritadi → AI (Gemini) vocabulary, MCQ savollar va AI tutor kontekstini generatsiya qiladi → forma avtomatik to'ldiriladi. Qo'lda yozishga ketadigan 30-60 daqiqa 30 soniyaga tushadi.

---

## Texnik Stack

- Google Gemini 2.5 Flash (mavjud `genai` client)
- NestJS `AiService` (kengaytiriladi)
- React `useState` + `apiRequest` (mavjud pattern)
- `/filadmin/lessons/new` sahifasi (mavjud)

---

## 1. Backend: Yangi Endpoint

### `POST /ai/generate-lesson`

**Auth:** `JwtAuthGuard` + `Roles(superadmin, filadmin)`

**Request:**
```json
{ "topic": "Present Simple Tense" }
```

**Response:**
```json
{
  "aiTutorContext": "Bu dars ingliz tilining Present Simple (oddiy hozirgi zamon) mavzusida. Asosiy gap tuzilishi: I/You/We/They + fe'l, He/She/It + fe'l + s. Misol gaplar: ...",
  "vocabulary": [
    { "word": "action", "translation": "harakat", "example": "Every day he takes action." },
    ...8-10 ta so'z
  ],
  "mcqQuestions": [
    {
      "question": "Which sentence uses Present Simple correctly?",
      "options": ["He go to school.", "He goes to school.", "He going to school.", "He gone to school."],
      "correctIndex": 1
    },
    ...10 ta savol
  ]
}
```

**Gemini Prompt:**
```
You are an English language teacher creating lesson materials for Uzbek students in grades 3-7.
Topic: "${topic}"

Generate the following in JSON format:
1. aiTutorContext: A 3-5 sentence context description for an AI tutor explaining this topic. Write in Uzbek.
2. vocabulary: 8-10 key English words related to this topic. Each with: word (English), translation (Uzbek), example (simple English sentence).
3. mcqQuestions: 10 multiple choice questions testing this topic. Each with: question (English), options (4 English options array), correctIndex (0-3).

Return ONLY valid JSON. No extra text.
```

**Xato holati:** Gemini ishlamasa → 503 (`AiService` mavjud fallback pattern'i ishlatiladi)

---

## 2. Frontend: Forma O'zgarishlari

### `/filadmin/lessons/new` sahifasi

**Yangi state'lar:**
```typescript
const [aiLoading, setAiLoading] = useState(false);
const [aiResult, setAiResult] = useState<AiLessonResult | null>(null);
const [aiApplied, setAiApplied] = useState(false);
```

**"AI bilan to'ldirish" tugmasi** — dars sarlavhasi kiritilgandan keyin ko'rinadi:
```
Mavzu: [Present Simple Tense    ]  [🤖 AI bilan to'ldirish ⟳]
```

**Generatsiya oqimi:**
1. Tugma bosiladi → `POST /ai/generate-lesson` → loading spinner
2. Natija keladi → preview panel ko'rsatiladi:
   - AI Tutor kontekst (textarea'ga preview)
   - Vocabulary: "8 ta so'z yaratildi: action, simple, every..."
   - MCQ: "10 ta savol yaratildi"
3. `[✅ Qabul qilish]` bosilsa → barcha maydonlar to'ldiriladi:
   - `aiTutorContext` textarea yangilanadi
   - vocabulary va MCQ saqlash uchun `generatedContent` state'ga qo'shiladi
4. `[🔄 Qayta]` bosilsa → yangidan generatsiya
5. `[✕ Rad etish]` → preview yopiladi

**Darsni saqlash** — forma submit bo'lganda (POST `/lessons`) qo'shimcha qadamlar:
1. Dars yaratiladi (mavjud logika)
2. `generatedContent.vocabulary` bor bo'lsa → `POST /lessons/:id/vocabulary`
3. `generatedContent.mcqQuestions` bor bo'lsa → `POST /lessons/:id/mcq`
   - (Bu endpoint'lar mavjud: `ComponentsService.setVocabulary`, `ComponentsService.setMcq`)

---

## 3. AiService Kengaytirish

`apps/api/src/ai/ai.service.ts` ga yangi metod:

```typescript
async generateLessonContent(topic: string): Promise<{
  aiTutorContext: string;
  vocabulary: Array<{ word: string; translation: string; example: string }>;
  mcqQuestions: Array<{ question: string; options: string[]; correctIndex: number }>;
}> {
  // Gemini ga JSON format so'rash
  // Response.text() ni JSON.parse()
  // Xato bo'lsa → ServiceUnavailableException
}
```

---

## 4. AiController Yangi Endpoint

```typescript
@Post('generate-lesson')
@Roles(UserRole.superadmin, UserRole.filadmin)
@UseGuards(JwtAuthGuard, RolesGuard)
generateLesson(@Body('topic') topic: string) {
  if (!topic?.trim()) throw new BadRequestException('Mavzu kiritilmagan');
  return this.ai.generateLessonContent(topic.trim());
}
```

---

## 5. UI/UX Tafsilotlar

### Preview Panel (inline kartochka)
```
┌─────────────────────────────────────────────────────┐
│ 🤖 AI yaratdi: "Present Simple Tense"               │
├─────────────────────────────────────────────────────┤
│ ✅ AI Tutor kontekst: "Bu dars ingliz tilining..."   │
│ ✅ Vocabulary: 8 ta so'z (action, simple, every...) │
│ ✅ MCQ: 10 ta savol                                 │
├─────────────────────────────────────────────────────┤
│ [✅ Qabul qilish]  [🔄 Qayta]  [✕ Rad etish]       │
└─────────────────────────────────────────────────────┘
```

### Muvaffaqiyat holati (qabul qilingandan keyin)
```
✅ AI yaratgan kontent qo'shildi — darsni saqlashda avtomatik yoziladi
```

---

## 6. Xavfsizlik

- Rate limiting: `@Throttle({ default: { ttl: 60_000, limit: 5 } })` — 5 ta generatsiya/daqiqa
- Topic validation: max 200 belgi, HTML strip
- Faqat `superadmin` va `filadmin` — student/mentor kira olmaydi

---

## 7. Test Strategiyasi

- Unit: `AiService.generateLessonContent()` — Gemini mock bilan JSON parse test
- Manual: Mavzu kiritib real Gemini javobini tekshirish
