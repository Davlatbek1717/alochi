import { randomBytes } from 'crypto';
import {
  encryptVector,
  decryptVector,
  encryptString,
  decryptString,
} from './vector-cipher';

describe('vector-cipher', () => {
  it('round-trips a 128-dim float vector', () => {
    const key = randomBytes(32);
    const vec = Array.from({ length: 128 }, () => Math.random() - 0.5);
    const ct = encryptVector(vec, key);
    expect(decryptVector(ct, key)).toEqual(vec);
  });

  it('round-trips an arbitrary UTF-8 string (Phase 18.9)', () => {
    const key = randomBytes(32);
    const plain = JSON.stringify({
      embeddings: [{ user_id: 'u1', name: "O'zbek", vector: [0.1, 0.2] }],
    });
    const ct = encryptString(plain, key);
    expect(decryptString(ct, key)).toEqual(plain);
  });

  it('rejects ciphertext under wrong key', () => {
    const key1 = randomBytes(32);
    const key2 = randomBytes(32);
    const ct = encryptString('secret', key1);
    expect(() => decryptString(ct, key2)).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    const shortKey = Buffer.alloc(16);
    expect(() => encryptString('x', shortKey)).toThrow(
      /must decode to exactly 32 bytes/,
    );
  });
});
