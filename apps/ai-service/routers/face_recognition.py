from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2
import os
from services.face_service import FaceRecognitionService, extract_embedding

router = APIRouter()


class RecognizeRequest(BaseModel):
    image_base64: str
    tenant_id: str
    branch_id: str


class RecognizeResponse(BaseModel):
    matched: bool
    user_id: Optional[str] = None
    confidence: float


class EnrollRequest(BaseModel):
    user_id: str
    tenant_id: str
    images_base64: list[str]
    enrolled_via: str = "mobile"


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize_face(request: RecognizeRequest):
    embedding = extract_embedding(request.image_base64)
    if embedding is None:
        return RecognizeResponse(matched=False, confidence=0.0)

    conn = get_db()
    try:
        service = FaceRecognitionService(conn)
        user_id, confidence = service.find_match(
            embedding, request.tenant_id, request.branch_id
        )
        return RecognizeResponse(
            matched=user_id is not None,
            user_id=user_id,
            confidence=confidence,
        )
    finally:
        conn.close()


@router.post("/enroll")
async def enroll_face(request: EnrollRequest):
    if len(request.images_base64) < 3:
        raise HTTPException(status_code=400, detail="Kamida 3 ta rasm kerak")

    embeddings = []
    for img_b64 in request.images_base64:
        emb = extract_embedding(img_b64)
        if emb is not None:
            embeddings.append(emb.tolist())

    if len(embeddings) < 3:
        raise HTTPException(
            status_code=400,
            detail="Yuzni aniqlab bo'lmadi — qayta urinib ko'ring",
        )

    conn = get_db()
    try:
        service = FaceRecognitionService(conn)
        success = service.enroll(
            request.user_id,
            request.tenant_id,
            embeddings,
            request.enrolled_via,
        )
        return {"enrolled": success, "embeddings_used": len(embeddings)}
    finally:
        conn.close()
