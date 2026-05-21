import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { InsightsService } from './insights.service';

@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Post('query')
  query(
    @Request() req: any,
    @Body() body: { question: string; scope?: 'branch' | 'student' | 'lesson' },
  ) {
    return this.insightsService.query(
      req.user.userId,
      req.user.tenantId,
      body.question,
      body.scope,
    );
  }

  @Get('history')
  getHistory(@Request() req: any) {
    return this.insightsService.getHistory(req.user.userId, req.user.tenantId);
  }

  @Patch(':id/rate')
  rateQuery(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { rating: number; feedback?: string },
  ) {
    return this.insightsService.rateQuery(id, req.user.userId, body.rating, body.feedback);
  }
}
