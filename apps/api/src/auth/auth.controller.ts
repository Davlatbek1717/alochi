import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('auth')
// Override the global 'default' throttler for auth endpoints — login + refresh
// must stay strict (5 req/min/IP) to block credential-stuffing. Logout is
// authenticated and inherits the same override; that's fine — even an attacker
// with a token can't loop logout faster than 5/min.
@Throttle({ default: { ttl: 60000, limit: 5 } })
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Login' })
  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: any) {
    const tenantSlug = req.headers['x-tenant-slug'];
    return this.authService.login(dto, tenantSlug);
  }

  @ApiOperation({ summary: 'Refresh token' })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Request() req: any) {
    return this.authService.logout(req.user.userId);
  }
}
