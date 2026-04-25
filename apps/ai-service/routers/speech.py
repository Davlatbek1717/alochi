from fastapi import APIRouter, HTTPException
from models.schemas import SpeechCheckRequest, SpeechCheckResponse
from services.azure_speech import AzureSpeechService
import os

router = APIRouter()


@router.post("/check", response_model=SpeechCheckResponse)
async def check_pronunciation(request: SpeechCheckRequest):
    if not os.getenv("AZURE_SPEECH_KEY"):
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
        return SpeechCheckResponse(
            is_correct=True,
            accuracy_score=0.0,
            feedback="Azure vaqtincha ishlamayapti — matnli javob qabul qilindi",
        )
