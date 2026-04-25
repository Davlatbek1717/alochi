from fastapi import APIRouter, HTTPException
from models.schemas import EvaluationRequest, EvaluationResponse
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


@router.post("/", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest):
    client = get_client()

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
