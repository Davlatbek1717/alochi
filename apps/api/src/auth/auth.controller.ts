import { Controller, Post, Body, UseGuards, Request, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { localeFromHeader } from '../i18n/errors';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardTenantDto } from '../tenants/dto/onboard-tenant.dto';

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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }
}
