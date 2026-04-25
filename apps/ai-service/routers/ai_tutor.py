from fastapi import APIRouter, HTTPException
from models.schemas import AiTutorRequest, AiTutorResponse
from services.claude_client import ClaudeClient

router = APIRouter()
_client: ClaudeClient | None = None

try:
    _client = ClaudeClient()
except Exception:
    pass  # handled per-request below


def get_client() -> ClaudeClient:
    if _client is None:
        raise HTTPException(status_code=503, detail="AI servis sozlanmagan — ANTHROPIC_API_KEY yo'q")
    return _client


@router.post("/ask", response_model=AiTutorResponse)
async def ask_ai_tutor(request: AiTutorRequest):
    client = get_client()

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Savol bo'sh bo'lmasligi kerak")

    try:
        answer = client.ask_tutor(
            lesson_context=request.lesson_context,
            question=request.question,
            history=request.conversation_history,
            student_level=request.student_level or "beginner",
        )
        return AiTutorResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI servis xatosi: {str(e)}")
