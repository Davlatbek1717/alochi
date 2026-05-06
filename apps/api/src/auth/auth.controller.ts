import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Headers,
  Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { localeFromHeader } from '../i18n/errors';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardTenantDto } from '../tenants/dto/onboard-tenant.dto';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
// Tight rate limit on all auth endpoints — brute-force protection.
@Throttle({ default: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Login' })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Request() req: any,
    @Headers('accept-language') acceptLang?: string,
  ) {
    const tenantSlug = req.headers['x-tenant-slug'];
    const locale = localeFromHeader(acceptLang);
    return this.authService.login(dto, tenantSlug, locale);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Self-service tenant registration (14-day trial)' })
  @Post('register')
  registerTenant(@Body() dto: OnboardTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('verify-2fa')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  verify2fa(@Body() body: { tempToken: string; code: string }) {
    return this.authService.verifyTwoFactor(body.tempToken, body.code);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.filadmin)
  setup2fa(@Request() req: any) {
    return this.authService.initTwoFactorSetup(req.user.userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.filadmin)
  enable2fa(
    @Body() body: { code: string; secret: string },
    @Request() req: any,
  ) {
    return this.authService.enableTwoFactor(
      req.user.userId,
      body.code,
      body.secret,
    );
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.filadmin)
  disable2fa(@Body() body: { code: string }, @Request() req: any) {
    return this.authService.disableTwoFactor(req.user.userId, body.code);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.filadmin)
  regenerateBackupCodes(@Body() body: { code: string }, @Request() req: any) {
    return this.authService.regenerateBackupCodes(req.user.userId, body.code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }
}
