from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from routers import ai_tutor, evaluation, speech, face_recognition

app = FastAPI(title="A'lojon AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORE_API_URL", "http://localhost:3000")],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

app.include_router(ai_tutor.router, prefix="/ai/tutor", tags=["AI Tutor"])
app.include_router(evaluation.router, prefix="/ai/evaluate", tags=["Evaluation"])
app.include_router(speech.router, prefix="/ai/speech", tags=["Speech"])
app.include_router(face_recognition.router, prefix="/face", tags=["Face Recognition"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}
