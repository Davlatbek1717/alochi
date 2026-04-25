import numpy as np
import face_recognition
import base64
import io
from PIL import Image
from typing import Optional

RECOGNITION_THRESHOLD = 0.80


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def image_from_base64(base64_str: str) -> np.ndarray:
    img_bytes = base64.b64decode(base64_str)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    return np.array(img)


def extract_embedding(image_base64: str) -> Optional[np.ndarray]:
    img = image_from_base64(image_base64)
    encodings = face_recognition.face_encodings(img)
    if not encodings:
        return None
    return encodings[0]


class FaceRecognitionService:
    def __init__(self, db_conn):
        self.conn = db_conn

    def find_match(
        self,
        query_embedding: np.ndarray,
        tenant_id: str,
        branch_id: str,
    ) -> tuple[Optional[str], float]:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT user_id, 1 - (embedding <=> %s::vector) AS cosine_sim
            FROM face_embeddings
            WHERE tenant_id = %s
              AND is_active = true
              AND user_id IN (
                SELECT id FROM users WHERE branch_id = %s AND status = 'active'
              )
            ORDER BY cosine_sim DESC
            LIMIT 1
            """,
            (query_embedding.tolist(), tenant_id, branch_id),
        )
        row = cur.fetchone()
        cur.close()

        if not row:
            return None, 0.0

        user_id, confidence = row
        if confidence < RECOGNITION_THRESHOLD:
            return None, float(confidence)

        return str(user_id), float(confidence)

    def enroll(
        self,
        user_id: str,
        tenant_id: str,
        embeddings: list[list[float]],
        enrolled_via: str = "mobile",
    ) -> bool:
        if not embeddings:
            return False

        avg_embedding = np.mean([np.array(e) for e in embeddings], axis=0)

        cur = self.conn.cursor()
        cur.execute(
            "UPDATE face_embeddings SET is_active = false WHERE user_id = %s",
            (user_id,),
        )
        cur.execute(
            """
            INSERT INTO face_embeddings (tenant_id, user_id, embedding, enrolled_via)
            VALUES (%s, %s, %s::vector, %s)
            """,
            (tenant_id, user_id, avg_embedding.tolist(), enrolled_via),
        )
        self.conn.commit()
        cur.close()
        return True
