import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { generateSecret, verifySync, generateURI } from 'otplib';
import * as bcrypt from 'bcrypt';
import * as qrcode from 'qrcode';
import { randomBytes } from 'crypto';

const BACKUP_CODE_COUNT = 10;
const TOTP_ISSUER = "A'lojon";

@Injectable()
export class TotpService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /** Generate an enrollment secret + QR code data URL (not yet saved). */
  async startEnrollment(userId: string): Promise<{ secret: string; qrDataUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { login: true, totpEnabled: true },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.totpEnabled) throw new BadRequestException('2FA allaqachon yoqilgan');

    const secret = generateSecret({ length: 20 });
    const otpauthUrl = generateURI({ label: user.login, issuer: TOTP_ISSUER, secret, strategy: 'totp' });
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    // Persist pending secret (not yet active — needs verify step)
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return { secret, qrDataUrl, otpauthUrl };
  }

  /** Verify the first code after scanning; activates 2FA and returns backup codes. */
  async verifyEnrollment(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true, role: true },
    });
    if (!user?.totpSecret) throw new BadRequestException("Avval /auth/2fa/enroll chaqiring");
    if (user.totpEnabled) throw new BadRequestException('2FA allaqachon yoqilgan');

    if (!verifySync({ token: code, secret: user.totpSecret })) {
      throw new BadRequestException('Noto\'g\'ri kod');
    }

    const plainCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpBackupCodes: hashedCodes, totpEnforcedAt: now },
    });

    return { backupCodes: plainCodes };
  }

  /** Disable 2FA — requires valid TOTP code or backup code. */
  async disable(userId: string, code: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true, totpBackupCodes: true, passwordHash: true, role: true },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (!user.totpEnabled) throw new BadRequestException('2FA yoqilmagan');

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) throw new ForbiddenException('Parol noto\'g\'ri');

    const validTotp = user.totpSecret && verifySync({ token: code, secret: user.totpSecret });
    const validBackup = !validTotp && await this.consumeBackupCode(user, code);
    if (!validTotp && !validBackup) throw new BadRequestException('Noto\'g\'ri kod');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [], totpEnforcedAt: null },
    });
  }

  /** Regenerate backup codes — requires TOTP confirmation. */
  async regenerateBackupCodes(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) throw new BadRequestException('2FA yoqilmagan');

    if (!verifySync({ token: code, secret: user.totpSecret })) {
      throw new BadRequestException('Noto\'g\'ri kod');
    }

    const plainCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: hashedCodes },
    });

    return { backupCodes: plainCodes };
  }

  /**
   * Validate a TOTP or backup code during the 2FA challenge login step.
   * Returns true on success; throws on failure.
   */
  async validateCode(userId: string, code: string): Promise<true> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true, totpBackupCodes: true },
    });
    if (!user?.totpEnabled || !user.totpSecret) {
      throw new BadRequestException('2FA yoqilmagan');
    }

    if (verifySync({ token: code, secret: user.totpSecret })) {
      return true;
    }

    // Try backup codes
    if (await this.consumeBackupCode(user, code)) {
      return true;
    }

    throw new BadRequestException('Noto\'g\'ri 2FA kodi');
  }

  /** Issue a short-lived temp token for the 2FA challenge step. */
  issueTempToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, purpose: '2fa_challenge' },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '5m',
      },
    );
  }

  /** Decode and validate a temp token; returns userId. */
  verifyTempToken(token: string): string {
    try {
      const payload = this.jwt.verify<{ sub: string; purpose: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.purpose !== '2fa_challenge') throw new Error('wrong_purpose');
      return payload.sub;
    } catch {
      throw new ForbiddenException('Temp token yaroqsiz yoki muddati o\'tgan');
    }
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
  }

  private async consumeBackupCode(
    user: { id?: string; totpBackupCodes: string[] },
    plain: string,
  ): Promise<boolean> {
    for (let i = 0; i < user.totpBackupCodes.length; i++) {
      if (await bcrypt.compare(plain, user.totpBackupCodes[i])) {
        // Remove used backup code
        const updated = [...user.totpBackupCodes];
        updated.splice(i, 1);
        if (user.id) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { totpBackupCodes: updated },
          });
        }
        return true;
      }
    }
    return false;
  }
}
