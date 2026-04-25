from pydantic import BaseModel
from typing import Optional


class AiTutorRequest(BaseModel):
    lesson_context: str
    question: str
    conversation_history: list[dict]
    student_level: Optional[str] = "beginner"


class AiTutorResponse(BaseModel):
    answer: str
    cached: bool = False


class EvaluationRequest(BaseModel):
    lesson_id: str
    student_answers: list[dict]
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
