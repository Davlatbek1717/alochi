import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardTenantDto } from '../tenants/dto/onboard-tenant.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
