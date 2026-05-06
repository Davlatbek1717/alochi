import { ConfigService } from '@nestjs/config';
import { TotpService } from './totp.service';

const mockConfig = {
  get: (key: string) => {
    if (key === 'TOTP_ENCRYPTION_KEY') return Buffer.from('a'.repeat(32)).toString('base64');
    return undefined;
  },
};

describe('TotpService', () => {
  let svc: TotpService;

  beforeEach(() => {
    svc = new TotpService(mockConfig as any);
  });

  it('generateSecret returns a non-empty base32 string', () => {
    const s = svc.generateSecret();
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(10);
  });

  it('encryptSecret + decryptSecret round-trips', () => {
    const secret = svc.generateSecret();
    const enc = svc.encryptSecret(secret);
    expect(enc).not.toBe(secret);
    expect(svc.decryptSecret(enc)).toBe(secret);
  });

  it('verifyToken returns truthy for a 6-digit code (mock accepts numeric codes)', () => {
    const secret = svc.generateSecret();
    // The otplib mock returns truthy for 6-digit numeric codes.
    expect(svc.verifyToken('123456', secret)).toBe(true);
  });

  it('verifyToken returns false for non-numeric / non-6-digit input', () => {
    const secret = svc.generateSecret();
    expect(svc.verifyToken('ABCDEF', secret)).toBe(false);
  });

  it('generateBackupCodes returns 8 codes in XXXX-XXXX format', async () => {
    const { plain } = await svc.generateBackupCodes();
    expect(plain).toHaveLength(8);
    expect(plain[0]).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('verifyBackupCode matches the correct code', async () => {
    const { plain, hashed } = await svc.generateBackupCodes();
    const idx = await svc.verifyBackupCode(plain[0], hashed);
    expect(idx).toBe(0);
  });

  it('verifyBackupCode returns -1 for wrong code', async () => {
    const { hashed } = await svc.generateBackupCodes();
    const idx = await svc.verifyBackupCode('XXXX-XXXX', hashed);
    expect(idx).toBe(-1);
  });
});
