import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM at-rest encryption for face embedding vectors.
 *
 * Output layout (base64 encoded):
 *   [12-byte IV][16-byte auth tag][ciphertext]
 *
 * Key MUST be 32 bytes (AES-256). Provide it via env FACE_VECTOR_KEY as a
 * base64 string — generate with: openssl rand -base64 32
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

export function encryptVector(vec: number[], key: Buffer): string {
  if (key.length !== 32) {
    throw new Error('FACE_VECTOR_KEY must decode to exactly 32 bytes');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = Buffer.from(JSON.stringify(vec));
  const ct = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptVector(b64: string, key: Buffer): number[] {
  if (key.length !== 32) {
    throw new Error('FACE_VECTOR_KEY must decode to exactly 32 bytes');
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString()) as number[];
}

/**
 * Encrypt an arbitrary UTF-8 string with AES-256-GCM, same envelope layout
 * as encryptVector ([12-byte IV][16-byte tag][ciphertext], base64 encoded).
 */
export function encryptString(plain: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error('FACE_VECTOR_KEY must decode to exactly 32 bytes');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(plain, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptString(b64: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error('FACE_VECTOR_KEY must decode to exactly 32 bytes');
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    'utf8',
  );
}

let cachedKey: Buffer | null = null;

export function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const k = process.env.FACE_VECTOR_KEY;
  if (!k) {
    throw new Error(
      'FACE_VECTOR_KEY env var required (base64-encoded 32 bytes)',
    );
  }
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) {
    throw new Error('FACE_VECTOR_KEY must decode to exactly 32 bytes');
  }
  cachedKey = buf;
  return cachedKey;
}

/** Test-only helper to reset the cached key between specs. */
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
}
