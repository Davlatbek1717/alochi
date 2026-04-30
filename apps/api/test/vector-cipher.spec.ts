import { randomBytes } from 'crypto';
import {
  encryptVector,
  decryptVector,
  loadKey,
  _resetKeyCacheForTests,
} from '../src/common/crypto/vector-cipher';

describe('vector-cipher (AES-256-GCM)', () => {
  const key = randomBytes(32);

  it('round-trips a 128-dim vector with full numeric fidelity', () => {
    const vec = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.123456);
    const ct = encryptVector(vec, key);
    const out = decryptVector(ct, key);
    expect(out).toEqual(vec);
  });

  it('produces different ciphertext on each encryption (unique IV)', () => {
    const vec = [0.1, 0.2, 0.3];
    const a = encryptVector(vec, key);
    const b = encryptVector(vec, key);
    expect(a).not.toBe(b);
  });

  it('throws when ciphertext is tampered with (auth tag check)', () => {
    const vec = [0.1, 0.2, 0.3];
    const ct = encryptVector(vec, key);
    const buf = Buffer.from(ct, 'base64');
    // flip a byte deep inside the ciphertext (past iv+tag)
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decryptVector(tampered, key)).toThrow();
  });

  it('throws when auth tag is tampered with', () => {
    const vec = [0.1, 0.2, 0.3];
    const ct = encryptVector(vec, key);
    const buf = Buffer.from(ct, 'base64');
    // flip a byte inside the auth tag region (offsets 12..27)
    buf[15] = buf[15] ^ 0xff;
    expect(() => decryptVector(buf.toString('base64'), key)).toThrow();
  });

  it('throws when wrong key is used', () => {
    const vec = [0.1, 0.2, 0.3];
    const ct = encryptVector(vec, key);
    const wrong = randomBytes(32);
    expect(() => decryptVector(ct, wrong)).toThrow();
  });

  it('throws if key length is not 32 bytes', () => {
    const tooShort = randomBytes(16);
    expect(() => encryptVector([1, 2, 3], tooShort)).toThrow(/32 bytes/);
  });

  describe('loadKey()', () => {
    const orig = process.env.FACE_VECTOR_KEY;
    beforeEach(() => _resetKeyCacheForTests());
    afterAll(() => {
      if (orig === undefined) delete process.env.FACE_VECTOR_KEY;
      else process.env.FACE_VECTOR_KEY = orig;
      _resetKeyCacheForTests();
    });

    it('throws when env var missing', () => {
      delete process.env.FACE_VECTOR_KEY;
      expect(() => loadKey()).toThrow(/FACE_VECTOR_KEY/);
    });

    it('throws when env var decodes to wrong length', () => {
      process.env.FACE_VECTOR_KEY = Buffer.from('short').toString('base64');
      expect(() => loadKey()).toThrow(/32 bytes/);
    });

    it('returns 32-byte buffer when env var valid', () => {
      process.env.FACE_VECTOR_KEY = randomBytes(32).toString('base64');
      const k = loadKey();
      expect(k.length).toBe(32);
    });
  });
});
