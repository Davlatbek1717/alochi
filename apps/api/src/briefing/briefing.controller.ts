import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { BriefingService } from './briefing.service';

@UseGuards(JwtAuthGuard)
@Controller('briefing')
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get('today')
  getToday(@Request() req: any) {
    return this.briefingService.getToday(req.user.tenantId, req.user.userId);
  }

  @Get(':date')
  getByDate(@Request() req: any, @Param('date') date: string) {
    return this.briefingService.getByDate(req.user.tenantId, req.user.userId, date);
  }

  @Post('regenerate')
  regenerate(@Request() req: any) {
    return this.briefingService.regenerate(req.user.tenantId, req.user.userId);
  }
}
