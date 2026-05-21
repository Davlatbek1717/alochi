import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardTenantDto } from '../tenants/dto/onboard-tenant.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private totpService: TotpService,
  ) {}

  @ApiOperation({ summary: 'Login' })
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: any) {
    const tenantSlug = req.headers['x-tenant-slug'];
    const ctx = {
      ip: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string) ?? '',
    };
    return this.authService.login(dto, tenantSlug, ctx);
  }

  @ApiOperation({ summary: 'Complete login when 2FA is required' })
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 10, ttl: 300_000 } })
  @Post('2fa/challenge')
  async twoFaChallenge(@Body() body: { tempToken: string; code: string }) {
    const userId = this.totpService.verifyTempToken(body.tempToken);
    await this.totpService.validateCode(userId, body.code);
    return this.authService.issueTokensForUserId(userId);
  }

  @ApiOperation({ summary: 'Enroll 2FA — returns QR code and secret' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enroll')
  twoFaEnroll(@Request() req: any) {
    return this.totpService.startEnrollment(req.user.userId);
  }

  @ApiOperation({ summary: 'Verify first code to activate 2FA' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  twoFaVerify(@Body() body: { code: string }, @Request() req: any) {
    return this.totpService.verifyEnrollment(req.user.userId, body.code);
  }

  @ApiOperation({ summary: 'Disable 2FA (requires password + current code)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async twoFaDisable(
    @Body() body: { code: string; password: string },
    @Request() req: any,
  ) {
    await this.totpService.disable(req.user.userId, body.code, body.password);
    return { ok: true };
  }

  @ApiOperation({ summary: 'Regenerate backup codes (requires current TOTP code)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/backup-codes/regenerate')
  twoFaRegenerateBackupCodes(@Body() body: { code: string }, @Request() req: any) {
    return this.totpService.regenerateBackupCodes(req.user.userId, body.code);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @Throttle({ short: { limit: 10, ttl: 60_000 }, medium: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Request() req: any) {
    const ctx = {
      ip: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string) ?? '',
    };
    return this.authService.refresh(dto.refreshToken, ctx);
  }

  @ApiOperation({ summary: 'Self-service tenant registration (14-day trial)' })
  @Post('register')
  registerTenant(@Body() dto: OnboardTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }
}
