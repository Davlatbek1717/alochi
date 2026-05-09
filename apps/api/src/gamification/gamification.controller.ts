import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { StreakService } from './streak.service';
import { QuestService } from './quest.service';
import { CertificatesService } from './certificates.service';
import { CityService } from './city.service';
import { LeaderboardService } from './leaderboard.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GamificationController {
  constructor(
    private streak: StreakService,
    private quest: QuestService,
    private certificates: CertificatesService,
    private cityService: CityService,
    private leaderboard: LeaderboardService,
  ) {}

  @Get('quests')
  getMyQuests(@Request() req: any) {
    return this.quest.getTodayQuests(req.user.userId);
  }

  @Get('certificates')
  getMyCertificates(@Request() req: any) {
    return this.certificates.getStudentCertificates(req.user.userId);
  }

  /** Returns configured milestone thresholds (bronze/silver/gold/diamond). */
  @Get('certificate-levels')
  getCertLevels() {
    return this.certificates.getLevels();
  }

  /** Returns the student's lesson count + progress toward every level. */
  @Get('certificate-progress')
  @Roles(UserRole.student)
  getCertProgress(@Request() req: any) {
    return this.certificates.getCertificateProgress(req.user.userId);
  }

  /**
   * Superadmin / manager can override the threshold and template image
   * for each certificate level. Each entry accepts either a bare number
   * (legacy: `minLessons`) or an object `{ minLessons?, imageUrl? }`.
   */
  @Put('certificate-levels')
  @Roles(UserRole.superadmin, UserRole.manager)
  saveCertLevels(
    @Body()
    body: Partial<
      Record<
        'bronze' | 'silver' | 'gold' | 'diamond',
        number | { minLessons?: number; imageUrl?: string | null }
      >
    >,
  ) {
    return this.certificates.saveLevels(body);
  }

  @Get('certificates/by-branch/:branchId')
  @Roles(UserRole.manager, UserRole.filadmin, UserRole.superadmin)
  getCertificatesByBranch(@Param('branchId') branchId: string) {
    return this.certificates.getCertificatesForBranch(branchId);
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

  @Get('streak')
  getMyStreak(@Request() req: any) {
    return this.streak.getStudentStreak(req.user.userId);
  }

  @Post('streak/activity')
  recordActivity(@Request() req: any) {
    return this.streak.recordActivity(req.user.userId);
  }

  @Get('city')
  getCity(@Request() req: any) {
    return this.cityService.getCity(req.user.userId);
  }

  @Get('leaderboard/branch')
  getBranchLeaderboard(@Request() req: any) {
    return this.leaderboard.getBranchLeaderboard(req.user.branchId);
  }

  @Get('leaderboard/national')
  getNationalLeaderboard(
    @Query('period') period: 'weekly' | 'monthly' = 'weekly',
    @Request() req: any,
  ) {
    return this.leaderboard.getNationalLeaderboard(period, req.user.tenantId);
  }

  @Get('leaderboard/group/:groupId')
  @Roles(
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.manager,
    UserRole.superadmin,
  )
  getGroupLeaderboard(@Param('groupId') groupId: string, @Request() req: any) {
    return this.leaderboard.getGroupLeaderboard(groupId, req.user.tenantId);
  }
}
