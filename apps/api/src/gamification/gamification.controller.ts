import { Controller, Get, Post, Param, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { XpService } from './xp.service';
import { StreakService } from './streak.service';
import { QuestService } from './quest.service';
import { CertificatesService } from './certificates.service';
import { CityService } from './city.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private xp: XpService,
    private streak: StreakService,
    private quest: QuestService,
    private certificates: CertificatesService,
    private cityService: CityService,
  ) {}

  @Get('xp')
  getMyXp(@Request() req: any) {
    return this.xp.getStudentXp(req.user.userId);
  }

  @Get('quests')
  getMyQuests(@Request() req: any) {
    return this.quest.getTodayQuests(req.user.userId);
  }

  @Get('certificates')
  getMyCertificates(@Request() req: any) {
    return this.certificates.getStudentCertificates(req.user.userId);
  }

  @Get('certificates/:id/pdf')
  async downloadCertificate(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.certificates.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${id}.pdf"`,
    });
    res.send(buffer);
  }

  @Post('streak/activity')
  recordActivity(@Request() req: any) {
    return this.streak.recordActivity(req.user.userId);
  }

  @Get('city')
  getCityLevel(@Request() req: any) {
    return this.cityService.getCityLevel(req.user.userId);
  }
}
