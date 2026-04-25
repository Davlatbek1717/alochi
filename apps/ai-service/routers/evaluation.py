from fastapi import APIRouter, HTTPException
from models.schemas import EvaluationRequest, EvaluationResponse
from services.claude_client import ClaudeClient

router = APIRouter()
client = ClaudeClient()


@router.post("/", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest):
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
