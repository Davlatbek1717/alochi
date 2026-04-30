-- Phase 1.3 — face embedding at-rest AES-256-GCM encryption
--
-- The pgvector column `embedding` stays for fast cosine search.
-- A new TEXT column `embedding_encrypted` stores the same vector
-- under AES-256-GCM (PDPL §533: math vectors must be unreadable
-- without a key). New enrollments populate both columns.
--
-- Layout of `embedding_encrypted` (base64):
--   [12-byte IV][16-byte GCM tag][ciphertext of JSON.stringify(vector)]

ALTER TABLE face_embeddings
  ADD COLUMN IF NOT EXISTS embedding_encrypted TEXT;

COMMENT ON COLUMN face_embeddings.embedding_encrypted IS
  'AES-256-GCM ciphertext of the averaged 128-dim descriptor. Decrypt with FACE_VECTOR_KEY env var (base64-encoded 32 bytes). PDPL §533.';
