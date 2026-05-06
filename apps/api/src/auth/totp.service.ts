import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateSecret as otpGenerateSecret,
  generateSync as otpGenerateSync,
  verifySync as otpVerifySync,
  generateURI,
} from 'otplib';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { encryptString, decryptString } from '../common/crypto/vector-cipher';

@Injectable()
export class TotpService {
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    const raw = this.config.get<string>('TOTP_ENCRYPTION_KEY') ?? '';
    this.key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(32, 0);
  }

  /** Generate a new base32 TOTP secret (NOT yet saved to DB). */
  generateSecret(): string {
    return otpGenerateSecret({ length: 20 });
  }

  /** Encrypt a TOTP secret for DB storage using AES-256-GCM. */
  encryptSecret(secret: string): string {
    return encryptString(secret, this.key);
  }

  /** Decrypt a stored TOTP secret. */
  decryptSecret(encrypted: string): string {
    return decryptString(encrypted, this.key);
  }

  /**
   * Build the otpauth:// URI for a QR code.
   * label = user's login, issuer = "Adouptivo"
   */
  buildOtpauthUrl(login: string, secret: string): string {
    return generateURI({
      label: login,
      issuer: 'Adouptivo',
      secret,
      strategy: 'totp',
    });
  }

  /** Verify a 6-digit TOTP token against the (already decrypted) secret. */
  verifyToken(token: string, decryptedSecret: string): boolean {
    try {
      const result: unknown = otpVerifySync({
        token,
        secret: decryptedSecret,
        strategy: 'totp',
      });
      // VerifyResult can be {delta: number} (valid) or false (invalid)
      return result !== false && result !== null && result !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Generate 8 one-time backup codes in XXXX-XXXX format.
   * Returns both the plain codes (show once to user) and bcrypt-hashed codes (store in DB).
   */
  async generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
    const plain: string[] = Array.from({ length: 8 }, () => {
      const a = randomBytes(2).toString('hex').toUpperCase();
      const b = randomBytes(2).toString('hex').toUpperCase();
      return `${a}-${b}`;
    });
    const hashed = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
    return { plain, hashed };
  }

  /**
   * Check a user-supplied backup code against the stored hash array.
   * Returns the index of the matching code (caller must splice it out to consume it),
   * or -1 if no match found.
   */
  async verifyBackupCode(supplied: string, hashes: string[]): Promise<number> {
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(supplied, hashes[i])) return i;
    }
    return -1;
  }
}
