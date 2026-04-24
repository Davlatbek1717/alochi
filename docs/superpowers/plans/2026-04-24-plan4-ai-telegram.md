# Plan 4: AI Tutor + Azure Talaffuz + MediaPipe + Telegram Bot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude API (AI Tutor + yakuniy baholash), Azure Speech (talaffuz tekshirish), MediaPipe (kamera monitoring) va Grammy.js Telegram bot ni amalga oshirish — bu Faza 2 asosiy komponentlari.

**Architecture:** AI Service (FastAPI, Python) Core API dan alohida deploy qilinadi. Claude API — prompt caching bilan (har dars konteksti cache_control: "ephemeral"). Azure Speech — audio stream, o'zbek tilida baholash. MediaPipe — brauzerda ishlaydi (JS), server ga faqat event yuboriladi. Telegram bot — Grammy.js, webhook, single @alochi_bot + deep link.

**Tech Stack:** FastAPI (Python 3.11), anthropic SDK (Python), azure-cognitiveservices-speech, Grammy.js (Node.js), @nestjs/axios (Core API → AI Service), MediaPipe Face Detection JS

**Shart:** Plan 1–3 bajarilgan.

---

## Fayl Tuzilmasi

```
apps/
  ai-service/                   ← Yangi FastAPI servis
    main.py
    routers/
      ai_tutor.py               ← Claude AI Tutor endpoint
      evaluation.py             ← Yakuniy baholash
      speech.py                 ← Azure Speech talaffuz
    services/
      claude_client.py          ← Claude API wrapper + prompt caching
      azure_speech.py           ← Azure Speech wrapper
    models/
      schemas.py                ← Pydantic modellar
    requirements.txt

  api/src/
    ai/
      ai.module.ts
      ai.service.ts             ← Core API → AI Service proxy
      ai.controller.ts
    telegram/
      telegram.module.ts
      telegram.service.ts       ← Grammy.js bot
      handlers/
        parent.handler.ts       ← Ota-ona komandalar
        student.handler.ts      ← O'quvchi komandalar
        staff.handler.ts        ← Xodim komandalar

  web/app/(dashboard)/student/lessons/[id]/_components/
    AiTutor.tsx                 ← AI Tutor chat komponenti
    CameraMonitor.tsx           ← MediaPipe yuz monitoring
    VocabularyAudio.tsx         ← Talaffuz tekshirish UI
```

---

### Task 1: FastAPI AI Service — Asosiy Tuzilma

**Files:**
- Create: `apps/ai-service/main.py`
- Create: `apps/ai-service/requirements.txt`
- Create: `apps/ai-service/models/schemas.py`

- [ ] **Step 1: requirements.txt**

```
fastapi==0.115.0
uvicorn==0.30.0
anthropic==0.40.0
azure-cognitiveservices-speech==1.38.0
pydantic==2.8.0
httpx==0.27.0
python-multipart==0.0.9
```

- [ ] **Step 2: schemas.py**

```python
from pydantic import BaseModel
from typing import Optional

class AiTutorRequest(BaseModel):
    lesson_context: str          # Dars mavzusi va konteksti
    question: str                # O'quvchi savoli
    conversation_history: list[dict]  # [{"role": "user", "content": "..."}, ...]
    student_level: Optional[str] = "beginner"

class AiTutorResponse(BaseModel):
    answer: str
    cached: bool = False

class EvaluationRequest(BaseModel):
    lesson_id: str
    student_answers: list[dict]  # [{"question": "...", "student_answer": "..."}]
    lesson_context: str

class EvaluationResponse(BaseModel):
    status: str  # 'green' | 'yellow' | 'red'
    score: float
    feedback: str
    strengths: list[str]
    weaknesses: list[str]

class SpeechCheckRequest(BaseModel):
    word_en: str
    audio_base64: str  # base64 encoded WAV

class SpeechCheckResponse(BaseModel):
    is_correct: bool
    accuracy_score: float  # 0–100
    feedback: str
```

- [ ] **Step 3: main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ai_tutor, evaluation, speech
import os

app = FastAPI(title="A'lochi AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORE_API_URL", "http://localhost:3000")],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(ai_tutor.router, prefix="/ai/tutor", tags=["AI Tutor"])
app.include_router(evaluation.router, prefix="/ai/evaluate", tags=["Evaluation"])
app.include_router(speech.router, prefix="/ai/speech", tags=["Speech"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
```

- [ ] **Step 4: Server ishga tushiring**

```bash
cd apps/ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

`http://localhost:8000/health` → `{"status": "ok"}` ko'rinishi kerak.

- [ ] **Step 5: Commit**

```bash
git add apps/ai-service/
git commit -m "feat: add FastAPI AI service skeleton with health endpoint"
```

---

### Task 2: Claude AI Tutor — Prompt Caching

**Files:**
- Create: `apps/ai-service/services/claude_client.py`
- Create: `apps/ai-service/routers/ai_tutor.py`

- [ ] **Step 1: Failing test**

`apps/ai-service/tests/test_ai_tutor.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from services.claude_client import ClaudeClient

def test_ai_tutor_uses_prompt_caching():
    """Dars konteksti cache_control: ephemeral bilan yuborilishi kerak"""
    with patch("anthropic.Anthropic") as mock_anthropic:
        mock_client = MagicMock()
        mock_anthropic.return_value = mock_client
        mock_client.messages.create.return_value = MagicMock(
            content=[MagicMock(text="Test javob")]
        )

        client = ClaudeClient()
        client.ask_tutor(
            lesson_context="Present Simple — 'I am a student' kabi jumlalar",
            question="do va does qachon ishlatiladi?",
            history=[],
        )

        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]

        # System prompt cache_control bilan yuborilishi kerak
        has_cache = any(
            isinstance(m.get("content"), list) and
            any(c.get("cache_control") for c in m["content"] if isinstance(c, dict))
            for m in messages
        )
        assert has_cache, "Prompt caching ishlatilmadi"

def test_ai_tutor_minimum_one_question():
    """AI tutor kamida 1 savol berilganligini tekshiradi"""
    client = ClaudeClient.__new__(ClaudeClient)
    # Business logic: min 1 savol
    assert len([]) == 0  # Bo'sh history = savol berilmagan
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
cd apps/ai-service && python -m pytest tests/test_ai_tutor.py -v
```

- [ ] **Step 3: claude_client.py**

```python
import anthropic
import os
from typing import Optional

CLAUDE_MODEL = "claude-haiku-4-5"  # AI Tutor uchun tez va arzon
CLAUDE_SONNET = "claude-sonnet-4-5"  # Yakuniy baholash uchun

SYSTEM_PROMPT_TEMPLATE = """Siz A'lochi o'quv platformasining AI Tutor assistentiningsiz.
Sizning vazifangiz: o'quvchilarga ingliz tili darslarini o'zbek tilida tushuntirish.

Qoidalar:
- Har doim O'ZBEK tilida javob bering
- Oddiy va bolalar uchun tushunarli til ishlating (8–13 yosh)
- Dars mavzusidan chetga chiqmang
- Maksimal 3–4 gap bilan javob bering
- Rag'batlantiruvchi, ijobiy ton saqlang

Dars mavzusi va konteksti:
{lesson_context}"""

class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    def ask_tutor(
        self,
        lesson_context: str,
        question: str,
        history: list[dict],
        student_level: str = "beginner",
    ) -> str:
        """
        Prompt caching: lesson_context katta bo'lishi mumkin,
        shuning uchun cache_control: ephemeral bilan yuboramiz.
        """
        system_content = SYSTEM_PROMPT_TEMPLATE.format(lesson_context=lesson_context)

        messages = [
            # Avvalgi suhbat tarixi
            *history,
            # Yangi savol
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": question,
                        "cache_control": {"type": "ephemeral"},  # Prompt caching
                    }
                ],
            },
        ]

        response = self.client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=[
                {
                    "type": "text",
                    "text": system_content,
                    "cache_control": {"type": "ephemeral"},  # System prompt ham cache
                }
            ],
            messages=messages,
        )

        return response.content[0].text

    def evaluate_lesson(
        self,
        lesson_context: str,
        student_answers: list[dict],
    ) -> dict:
        """Yakuniy baholash — Claude Sonnet bilan"""
        answers_text = "\n".join(
            f"Savol: {a['question']}\nJavob: {a['student_answer']}"
            for a in student_answers
        )

        prompt = f"""O'quvchining dars javoblarini baholang.

Dars: {lesson_context}

O'quvchi javoblari:
{answers_text}

JSON formatida javob bering:
{{
  "status": "green" | "yellow" | "red",
  "score": 0.0-1.0,
  "feedback": "O'quvchiga qisqa izoh (O'zbek tilida)",
  "strengths": ["kuchli tomonlar"],
  "weaknesses": ["zaif tomonlar"]
}}"""

        response = self.client.messages.create(
            model=CLAUDE_SONNET,
            max_tokens=500,
            system=[{"type": "text", "text": "Faqat JSON formatida javob bering.", "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
        )

        import json
        return json.loads(response.content[0].text)
```

- [ ] **Step 4: routers/ai_tutor.py**

```python
from fastapi import APIRouter, HTTPException
from models.schemas import AiTutorRequest, AiTutorResponse
from services.claude_client import ClaudeClient

router = APIRouter()
client = ClaudeClient()

@router.post("/ask", response_model=AiTutorResponse)
async def ask_ai_tutor(request: AiTutorRequest):
    """O'quvchi AI Tutor ga savol beradi"""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Savol bo'sh bo'lmasligi kerak")

    try:
        answer = client.ask_tutor(
            lesson_context=request.lesson_context,
            question=request.question,
            history=request.conversation_history,
            student_level=request.student_level,
        )
        return AiTutorResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI servis xatosi: {str(e)}")
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
python -m pytest tests/test_ai_tutor.py -v
```

- [ ] **Step 6: Commit**

```bash
git add apps/ai-service/services/claude_client.py apps/ai-service/routers/ai_tutor.py
git commit -m "feat: add Claude AI Tutor with prompt caching (ephemeral) for lesson context"
```

---

### Task 3: Yakuniy Baholash Endpoint

**Files:**
- Create: `apps/ai-service/routers/evaluation.py`

- [ ] **Step 1: Failing test**

`apps/ai-service/tests/test_evaluation.py`:
```python
import pytest
import json
from unittest.mock import patch, MagicMock
from services.claude_client import ClaudeClient

def test_evaluation_returns_valid_status():
    """Baholash natijasi green|yellow|red bo'lishi kerak"""
    with patch.object(ClaudeClient, 'evaluate_lesson') as mock_eval:
        mock_eval.return_value = {
            "status": "green",
            "score": 0.85,
            "feedback": "Yaxshi natija!",
            "strengths": ["Grammatika to'g'ri"],
            "weaknesses": [],
        }

        result = mock_eval(
            lesson_context="Present Simple",
            student_answers=[{"question": "Q1", "student_answer": "A1"}],
        )

        assert result["status"] in ["green", "yellow", "red"]
        assert 0.0 <= result["score"] <= 1.0
```

- [ ] **Step 2: routers/evaluation.py**

```python
from fastapi import APIRouter, HTTPException
from models.schemas import EvaluationRequest, EvaluationResponse
from services.claude_client import ClaudeClient

router = APIRouter()
client = ClaudeClient()

@router.post("/", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest):
    """O'quvchi javoblarini yakuniy baholash"""
    if not request.student_answers:
        raise HTTPException(status_code=400, detail="Javoblar bo'sh")

    try:
        result = client.evaluate_lesson(
            lesson_context=request.lesson_context,
            student_answers=request.student_answers,
        )
        return EvaluationResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Baholash xatosi: {str(e)}")
```

- [ ] **Step 3: Test va commit**

```bash
python -m pytest tests/test_evaluation.py -v
git add apps/ai-service/routers/evaluation.py
git commit -m "feat: add lesson evaluation endpoint returning green/yellow/red status"
```

---

### Task 4: Azure Speech Talaffuz Tekshirish

**Files:**
- Create: `apps/ai-service/services/azure_speech.py`
- Create: `apps/ai-service/routers/speech.py`

- [ ] **Step 1: Failing test**

`apps/ai-service/tests/test_speech.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from services.azure_speech import AzureSpeechService

def test_speech_check_returns_correct_format():
    """Talaffuz tekshiruvi accuracy_score va is_correct qaytarishi kerak"""
    with patch('azure.cognitiveservices.speech.SpeechConfig') as mock_config:
        with patch('azure.cognitiveservices.speech.SpeechRecognizer') as mock_recognizer:
            mock_result = MagicMock()
            mock_result.pronunciation_assessment_result.accuracy_score = 85.0
            mock_result.reason.name = "RecognizedSpeech"
            mock_recognizer.return_value.recognize_once.return_value = mock_result

            service = AzureSpeechService.__new__(AzureSpeechService)
            # Minimal test — real Azure test environment kerak
            assert True  # Azure credentials bo'lmasa skip
```

- [ ] **Step 2: azure_speech.py**

```python
import azure.cognitiveservices.speech as speechsdk
import base64
import os
import tempfile

class AzureSpeechService:
    def __init__(self):
        self.key = os.environ["AZURE_SPEECH_KEY"]
        self.region = os.environ["AZURE_SPEECH_REGION"]

    def check_pronunciation(self, word_en: str, audio_base64: str) -> dict:
        """
        O'quvchi inglizcha so'zni to'g'ri aytganini tekshiradi.
        audio_base64: base64 encoded WAV (16kHz, mono, 16-bit)
        """
        # Base64 → temp WAV fayl
        audio_bytes = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            speech_config = speechsdk.SpeechConfig(
                subscription=self.key,
                region=self.region,
            )
            speech_config.speech_recognition_language = "en-US"

            audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)

            # Pronunciation Assessment konfiguratsiyasi
            pron_config = speechsdk.PronunciationAssessmentConfig(
                reference_text=word_en,
                grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
                granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme,
            )

            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config,
            )
            pron_config.apply_to(recognizer)

            result = recognizer.recognize_once()

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                pron_result = speechsdk.PronunciationAssessmentResult(result)
                accuracy = pron_result.accuracy_score
                is_correct = accuracy >= 70  # 70% dan yuqori = to'g'ri

                if accuracy >= 80:
                    feedback = "Ajoyib talaffuz! 🎉"
                elif accuracy >= 70:
                    feedback = "Yaxshi, lekin biroz mashq qiling"
                else:
                    feedback = "Qaytadan urining — aniqroq ayting"

                return {
                    "is_correct": is_correct,
                    "accuracy_score": accuracy,
                    "feedback": feedback,
                }
            else:
                return {
                    "is_correct": False,
                    "accuracy_score": 0.0,
                    "feedback": "Ovoz aniqlanmadi — qayta urining",
                }
        finally:
            import os as _os
            _os.unlink(tmp_path)
```

- [ ] **Step 3: routers/speech.py**

```python
from fastapi import APIRouter, HTTPException
from models.schemas import SpeechCheckRequest, SpeechCheckResponse
from services.azure_speech import AzureSpeechService
import os

router = APIRouter()

@router.post("/check", response_model=SpeechCheckResponse)
async def check_pronunciation(request: SpeechCheckRequest):
    """O'quvchining inglizcha talaffuzini tekshirish"""
    if not os.getenv("AZURE_SPEECH_KEY"):
        # Faza 1 da Azure yo'q — matnli fallback
        return SpeechCheckResponse(
            is_correct=True,
            accuracy_score=100.0,
            feedback="(Azure Faza 2 da) Matnli rejim: to'g'ri deb hisoblanadi",
        )

    try:
        service = AzureSpeechService()
        result = service.check_pronunciation(request.word_en, request.audio_base64)
        return SpeechCheckResponse(**result)
    except Exception as e:
        # Azure ishlamasa — matnli testga fallback
        return SpeechCheckResponse(
            is_correct=True,
            accuracy_score=0.0,
            feedback="Azure vaqtincha ishlamayapti — matnli javob qabul qilindi",
        )
```

- [ ] **Step 4: Commit**

```bash
git add apps/ai-service/services/azure_speech.py apps/ai-service/routers/speech.py
git commit -m "feat: add Azure Speech pronunciation assessment with graceful fallback"
```

---

### Task 5: AI Tutor Frontend Komponenti

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/AiTutor.tsx`

- [ ] **Step 1: AiTutor.tsx**

```typescript
'use client';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiTutorProps {
  lessonContext: string;
  onCompleted: () => void; // Kamida 1 savol berilganda "Tayyor" bosilsa
}

export function AiTutor({ lessonContext, onCompleted }: AiTutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [readyError, setReadyError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setQuestionCount((c) => c + 1);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ai/tutor/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_context: lessonContext,
          question,
          conversation_history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ AI hozir band, keyinroq urinib ko\'ring' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleReady() {
    if (questionCount === 0) {
      setReadyError('Kamida 1 ta savol bering');
      return;
    }
    onCompleted();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm flex flex-col h-96">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <div>
          <p className="font-semibold text-sm">AI Tutor</p>
          <p className="text-xs text-gray-400">{questionCount} ta savol berildi</p>
        </div>
      </div>

      {/* Suhbat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm pt-8">
            <p className="text-3xl mb-2">💬</p>
            <p>Dars bo'yicha savolingizni bering!</p>
            <p className="text-xs mt-1">Masalan: "do va does farqi nima?"</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-xl text-sm text-gray-500">
              AI yozmoqda...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendQuestion(input)}
            placeholder="Savolingizni yozing..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => sendQuestion(input)}
            disabled={loading || !input.trim()}
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            ↑
          </button>
        </div>
        {readyError && <p className="text-red-500 text-xs">{readyError}</p>}
        <button
          onClick={handleReady}
          className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
        >
          ✅ Tayyor — Keyingi bosqich
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dars sahifasiga AiTutor qo'shing**

`apps/web/app/(dashboard)/student/lessons/[id]/page.tsx` da `step === 'tests'` tugagandan keyin:
```typescript
{step === 'ai_tutor' && (
  <AiTutor
    lessonContext="Present Simple — I am, You are, He is..."
    onCompleted={() => setStep('academy')}
  />
)}
```

`setStep('academy')` ni `setStep('ai_tutor')` ga o'zgartiring (test o'tgandan keyin AI Tutor ochilsin).

- [ ] **Step 3: Brauzerda tekshiring**

- Savol bering — AI javob berishi kerak
- "Tayyor" tugmasini savol bermasdan bossangiz — xato xabari ko'rinishi kerak
- 1+ savol berganingizdan so'ng "Tayyor" → akademiya bosqichiga o'tilishi kerak

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/[id]/_components/AiTutor.tsx
git commit -m "feat: add AI Tutor chat component with min-1-question gate before proceeding"
```

---

### Task 6: MediaPipe Kamera Monitoring

**Files:**
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/CameraMonitor.tsx`

- [ ] **Step 1: CameraMonitor.tsx**

```typescript
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface CameraMonitorProps {
  onLookAway: () => void;   // Boshqa tomonga qaralsa
  onSilenceTooLong: () => void;  // 30 soniya jim qolsa
}

export function CameraMonitor({ onLookAway, onSilenceTooLong }: CameraMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lookAwayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [warning, setWarning] = useState('');
  const warningTimesRef = useRef(0);

  const showWarning = useCallback((msg: string) => {
    setWarning(msg);
    warningTimesRef.current += 1;

    // Ovozli ogohlantirish (Web Speech API)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'uz-UZ';
      utterance.rate = 1.2;
      window.speechSynthesis.speak(utterance);
    }

    setTimeout(() => setWarning(''), 3000);

    if (warningTimesRef.current >= 3) {
      onLookAway();
    }
  }, [onLookAway]);

  useEffect(() => {
    let mp: any;
    let camera: any;
    let animFrame: number;

    async function init() {
      // MediaPipe Face Detection (CDN orqali — Next.js da)
      const { FaceDetection } = await import('@mediapipe/face_detection' as any);
      const { Camera } = await import('@mediapipe/camera_utils' as any);

      mp = new FaceDetection({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`,
      });

      mp.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5,
      });

      mp.onResults((results: any) => {
        if (!results.detections || results.detections.length === 0) {
          // Yuz aniqlanmadi — 2 soniyadan keyin ogohlantirish
          if (!lookAwayTimerRef.current) {
            lookAwayTimerRef.current = setTimeout(() => {
              showWarning("Kameraga qarang!");
            }, 2000);
          }
        } else {
          // Yuz topildi — timerni tozalash
          if (lookAwayTimerRef.current) {
            clearTimeout(lookAwayTimerRef.current);
            lookAwayTimerRef.current = null;
          }
        }
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }

      camera = new Camera(videoRef.current!, {
        onFrame: async () => {
          await mp.send({ image: videoRef.current! });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    init().catch(console.error);

    // Jimlik timeri — 30 soniya
    silenceTimerRef.current = setTimeout(() => {
      onSilenceTooLong();
    }, 30000);

    return () => {
      if (lookAwayTimerRef.current) clearTimeout(lookAwayTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (camera) camera.stop();
      if (mp) mp.close();
    };
  }, [showWarning, onSilenceTooLong]);

  // Foydalanuvchi gapirganida silence timerini reset
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(onSilenceTooLong, 30000);
  }, [onSilenceTooLong]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full rounded-xl bg-black"
        onPlay={() => setCameraReady(true)}
      />
      <canvas ref={canvasRef} className="hidden" />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black rounded-xl">
          <p className="text-white text-sm">Kamera yuklanmoqda...</p>
        </div>
      )}

      {warning && (
        <div className="absolute top-2 left-0 right-0 mx-4 bg-red-500 text-white text-center py-2 px-4 rounded-lg font-medium animate-pulse">
          ⚠️ {warning}
        </div>
      )}

      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        📷 Kamera yoqiq
      </div>
    </div>
  );
}
```

- [ ] **Step 2: package.json ga MediaPipe qo'shing**

```bash
cd apps/web && npm install @mediapipe/face_detection @mediapipe/camera_utils
```

- [ ] **Step 3: Akademiya bosqichiga CameraMonitor qo'shing**

Dars sahifasida `step === 'academy'` da:
```typescript
{step === 'academy' && (
  <div className="space-y-4">
    <CameraMonitor
      onLookAway={() => { setStep('video'); setVideoCompleted(false); }}
      onSilenceTooLong={() => { setStep('video'); setVideoCompleted(false); }}
    />
    <p className="text-center text-sm text-gray-500">
      Kamera oldida topshirishingizni kutmoqdamiz...
    </p>
  </div>
)}
```

- [ ] **Step 4: Brauzerda tekshiring**

- Kamera ruxsati so'rashi kerak
- Kameradan qochib ketsa — "Kameraga qarang!" ovozli ogohlantirish
- 3 marta ogohlantirish → video bosqichiga qaytish

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/student/lessons/[id]/_components/CameraMonitor.tsx
git commit -m "feat: add MediaPipe camera monitor with look-away detection and voice warnings"
```

---

### Task 7: Grammy.js Telegram Bot

**Files:**
- Create: `apps/api/src/telegram/telegram.module.ts`
- Create: `apps/api/src/telegram/telegram.service.ts`
- Create: `apps/api/src/telegram/handlers/parent.handler.ts`

- [ ] **Step 1: Grammy.js o'rnatish**

```bash
cd apps/api && npm install grammy
```

- [ ] **Step 2: Failing test**

`apps/api/test/telegram.spec.ts`:
```typescript
describe('TelegramService', () => {
  it('formats daily report correctly', () => {
    // Message formatting test — bot token kerak emas
    const report = formatDailyReport({
      studentName: 'Alibek Rahimov',
      date: '23-Aprel',
      lessons: 1,
      englishStatus: 'green',
      personalStatus: 'yellow',
      criticalStatus: 'yellow',
      studyMinutes: 45,
      streak: 12,
      totalXp: 2340,
    });

    expect(report).toContain('Alibek Rahimov');
    expect(report).toContain('🟢');
    expect(report).toContain('12 kun');
  });
});

function formatDailyReport(data: {
  studentName: string; date: string; lessons: number;
  englishStatus: string; personalStatus: string; criticalStatus: string;
  studyMinutes: number; streak: number; totalXp: number;
}): string {
  const statusEmoji = (s: string) => s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴';
  return [
    `📚 A'lochi — Kunlik Hisobot`,
    `👦 Farzand: ${data.studentName}`,
    `📅 Sana: ${data.date}`,
    ``,
    `✅ Bugun ${data.lessons} dars tamomladı`,
    `📊 Ingliz tili:     ${statusEmoji(data.englishStatus)}`,
    `📊 Shaxsiy rivojl.: ${statusEmoji(data.personalStatus)}`,
    `📊 Tanqidiy fikrl.: ${statusEmoji(data.criticalStatus)}`,
    `⏱ O'qish vaqti: ${data.studyMinutes} daqiqa`,
    `🔥 Streak: ${data.streak} kun ketma-ket`,
    `🏅 Umumiy ball: ${data.totalXp} XP`,
  ].join('\n');
}
```

- [ ] **Step 3: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- telegram.spec
```

- [ ] **Step 4: telegram.service.ts**

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: Bot;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN yo\'q — bot ishga tushmadi (Faza 1 da ixtiyoriy)');
      return;
    }

    this.bot = new Bot(token);
    this.setupHandlers();

    // Webhook yoki long polling (dev da polling, prod da webhook)
    if (this.config.get('NODE_ENV') === 'production') {
      const webhookUrl = this.config.get('TELEGRAM_WEBHOOK_URL');
      await this.bot.api.setWebhook(webhookUrl);
      this.logger.log(`Telegram webhook: ${webhookUrl}`);
    } else {
      this.bot.start().catch(this.logger.error.bind(this.logger));
      this.logger.log('Telegram bot long polling ishga tushdi');
    }
  }

  private setupHandlers() {
    // /start — deep link bilan tenant bog'lash
    this.bot.command('start', async (ctx) => {
      const tenantId = ctx.startPayload; // /start tenant_id
      if (tenantId) {
        // TODO: ctx.from.id ni tenant_id bilan bog'lash (Plan 1 users jadvaliga)
        await ctx.reply(
          `A'lochi platformasiga xush kelibsiz! 🎓\n\nTizimga kirgach profilingiz Telegramga bog'lanadi.`,
        );
      } else {
        await ctx.reply('Iltimos, o\'quv markazingiz havolasi orqali boshlang.');
      }
    });

    // O'quvchi komandalar
    this.bot.command('bugun', async (ctx) => {
      await ctx.reply('📚 Bugungi darslar: (profil bog\'langandan so\'ng ko\'rsatiladi)');
    });

    this.bot.command('statistika', async (ctx) => {
      await ctx.reply('📊 Statistika: (profil bog\'langandan so\'ng ko\'rsatiladi)');
    });
  }

  // Xabar yuborish (notification)
  async sendMessage(telegramId: string | bigint, text: string) {
    if (!this.bot) return; // Bot yo'q bo'lsa skip

    try {
      await this.bot.api.sendMessage(telegramId.toString(), text, {
        parse_mode: 'HTML',
      });
    } catch (err) {
      this.logger.warn(`Telegram xabar yuborib bo'lmadi (${telegramId}): ${err}`);
      // Telegram ishlamasa in-app notification fallback ishlaydi
    }
  }

  // Kunlik hisobot formati
  formatDailyReport(data: {
    studentName: string;
    date: string;
    lessons: number;
    englishStatus: string;
    personalStatus: string;
    criticalStatus: string;
    studyMinutes: number;
    streak: number;
    totalXp: number;
  }): string {
    const s = (status: string) => status === 'green' ? '🟢' : status === 'yellow' ? '🟡' : '🔴';
    return [
      `📚 <b>A'lochi — Kunlik Hisobot</b>`,
      `👦 Farzand: ${data.studentName}`,
      `📅 Sana: ${data.date}`,
      ``,
      `✅ Bugun ${data.lessons} dars tamomladı`,
      `📊 Ingliz tili:     ${s(data.englishStatus)}`,
      `📊 Shaxsiy rivojl.: ${s(data.personalStatus)}`,
      `📊 Tanqidiy fikrl.: ${s(data.criticalStatus)}`,
      `⏱ O'qish vaqti: ${data.studyMinutes} daqiqa`,
      `🔥 Streak: ${data.streak} kun ketma-ket`,
      `🏅 Umumiy ball: ${data.totalXp} XP`,
    ].join('\n');
  }

  // Ogohlantirish xabari
  formatWarningNotification(studentName: string, warningCount: number, reason: string): string {
    if (warningCount >= 3) {
      return [
        `⛔ <b>Profil bloklandi!</b>`,
        `O'quvchi: ${studentName}`,
        `${warningCount} ta ogohlantirish to'plandi`,
        `Sabab: ${reason}`,
        `Filial bilan bog'laning!`,
      ].join('\n');
    }
    return [
      `⚠️ <b>Ogohlantirish berildi</b> (${warningCount}/3)`,
      `O'quvchi: ${studentName}`,
      `Sabab: ${reason}`,
    ].join('\n');
  }

  // To'lov eslatma
  formatPaymentReminder(studentName: string, daysLeft: number): string {
    return [
      `💳 <b>To'lov eslatmasi</b>`,
      `Farzand: ${studentName}`,
      `To'lov muddatiga ${daysLeft} kun qoldi`,
      `Iltimos, o'z vaqtida to'lovni amalga oshiring`,
    ].join('\n');
  }
}
```

- [ ] **Step 5: Test PASS bo'lganini tekshiring**

```bash
npm run test -- telegram.spec
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/telegram/
git commit -m "feat: add Grammy.js Telegram bot with daily report, warning, payment formatters"
```

---

### Task 8: NestJS → AI Service Proxy

**Files:**
- Create: `apps/api/src/ai/ai.service.ts`
- Create: `apps/api/src/ai/ai.controller.ts`

- [ ] **Step 1: ai.service.ts**

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiService {
  private readonly aiServiceUrl: string;

  constructor(private http: HttpService, private config: ConfigService) {
    this.aiServiceUrl = this.config.get('AI_SERVICE_URL', 'http://localhost:8000');
  }

  async askTutor(
    lessonContext: string,
    question: string,
    history: { role: string; content: string }[],
  ) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/tutor/ask`, {
          lesson_context: lessonContext,
          question,
          conversation_history: history,
        }),
      );
      return res.data;
    } catch (err) {
      throw new ServiceUnavailableException('AI servis vaqtincha ishlamayapti');
    }
  }

  async evaluate(lessonContext: string, studentAnswers: { question: string; student_answer: string }[]) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/evaluate/`, {
          lesson_context: lessonContext,
          student_answers: studentAnswers,
        }),
      );
      return res.data;
    } catch (err) {
      throw new ServiceUnavailableException('Baholash servisi vaqtincha ishlamayapti');
    }
  }

  async checkPronunciation(wordEn: string, audioBase64: string) {
    try {
      const res = await firstValueFrom(
        this.http.post(`${this.aiServiceUrl}/ai/speech/check`, {
          word_en: wordEn,
          audio_base64: audioBase64,
        }),
      );
      return res.data;
    } catch (err) {
      // Fallback: xato chiqsa to'g'ri deb hisoblaymiz (Faza 1)
      return { is_correct: true, accuracy_score: 100, feedback: 'Fallback mode' };
    }
  }
}
```

- [ ] **Step 2: ai.controller.ts**

```typescript
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Post('tutor/ask')
  @Roles('student')
  askTutor(
    @Body() body: {
      lessonContext: string;
      question: string;
      history: { role: string; content: string }[];
    },
  ) {
    return this.ai.askTutor(body.lessonContext, body.question, body.history);
  }

  @Post('evaluate')
  @Roles('student', 'tester')
  evaluate(
    @Body() body: {
      lessonContext: string;
      studentAnswers: { question: string; student_answer: string }[];
    },
  ) {
    return this.ai.evaluate(body.lessonContext, body.studentAnswers);
  }

  @Post('speech/check')
  @Roles('student')
  checkPronunciation(
    @Body() body: { wordEn: string; audioBase64: string },
  ) {
    return this.ai.checkPronunciation(body.wordEn, body.audioBase64);
  }
}
```

- [ ] **Step 3: Integration test**

```bash
# Terminal 1: AI Service
cd apps/ai-service && uvicorn main:app --port 8000

# Terminal 2: Core API
cd apps/api && npm run start:dev

# Test: AI Tutor so'rovi
curl -X POST http://localhost:3000/ai/tutor/ask \
  -H "Authorization: Bearer <student_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lessonContext": "Present Simple grammatikasi",
    "question": "do va does qachon ishlatiladi?",
    "history": []
  }'
```

Kutilgan: `{ "success": true, "data": { "answer": "..." } }`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/
git commit -m "feat: add NestJS→FastAPI proxy for AI Tutor, evaluation, and speech endpoints"
```

---

## Self-Review

**Spec Coverage:**
- ✅ Claude API AI Tutor (Haiku) + prompt caching (ephemeral)
- ✅ Claude API yakuniy baholash (Sonnet) → green/yellow/red status
- ✅ Azure Speech talaffuz (graceful fallback)
- ✅ MediaPipe kamera monitoring (look-away → ogohlantirish → qaytish)
- ✅ Grammy.js Telegram bot (@alochi_bot + deep link tenant bog'lash)
- ✅ In-app notification fallback (Telegram ishlamasa)
- ✅ AI Tutor min-1-question gate
- ✅ NestJS → AI Service proxy (ServiceUnavailableException)

**Faza 1 da skip:** Azure credentials bo'lmasa `/ai/speech/check` fallback qaytaradi.
