CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE face_embeddings ADD COLUMN IF NOT EXISTS embedding vector(128);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_cosine
  ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_face_embeddings_active
  ON face_embeddings(user_id)
  WHERE is_active = true;
