import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { VideoCheckinService } from './video-checkin.service';
import { ConfigService } from '@nestjs/config';
import { tashkentDateString } from './lib/tashkent-time';

interface JwtUser {
  userId: string;
  tenantId: string;
  role: UserRole;
  branchId?: string | null;
  groupId?: string | null;
}

@ApiTags('video-checkins')
@ApiBearerAuth()
@Controller('video-checkins')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VideoCheckinController {
  constructor(
    private service: VideoCheckinService,
    private config: ConfigService,
  ) {}

  private get uploadDir(): string {
    return this.config.get<string>('VIDEO_UPLOAD_DIR') ?? '/var/www/alochi/uploads/videos';
  }

  /**
   * GET /video-checkins/today?branchId=
   */
  @Get('today')
  @Roles(UserRole.filadmin, UserRole.mentor, UserRole.manager, UserRole.superadmin)
  async getToday(
    @Query('branchId') branchId: string,
    @Request() req: { user: JwtUser },
  ) {
    if (!branchId) throw new BadRequestException('branchId parametri talab etiladi');
    if (req.user.role === UserRole.filadmin) {
      if (req.user.branchId && req.user.branchId !== branchId) {
        throw new ForbiddenException("Siz faqat o'z filialingizni ko'ra olasiz");
      }
    }
    return this.service.getTodayList(branchId);
  }

  /**
   * GET /video-checkins/monitoring?date=YYYY-MM-DD
   */
  @Get('monitoring')
  @Roles(UserRole.filadmin, UserRole.mentor, UserRole.manager, UserRole.superadmin)
  async getMonitoring(
    @Query('date') date: string | undefined,
    @Request() req: { user: JwtUser },
  ) {
    return this.service.getMonitoring(
      {
        userId: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId,
        branchId: req.user.branchId ?? null,
        groupId: req.user.groupId ?? null,
      },
      date,
    );
  }

  /**
   * GET /video-checkins/my-today
   * Student: get their own today's window status and upload eligibility.
   */
  @Get('my-today')
  @Roles(UserRole.student)
  async getMyToday(@Request() req: { user: JwtUser }) {
    return this.service.getTodayStatusForStudent(req.user.userId);
  }

  /**
   * POST /video-checkins/upload
   * Student uploads a video for the currently open window (morning or evening).
   * File is stored on disk; DB row is upserted.
   */
  @Post('upload')
  @Roles(UserRole.student)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB cap
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Faqat video fayllar qabul qilinadi'), false);
        }
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = process.env.VIDEO_UPLOAD_DIR ?? '/var/www/alochi/uploads/videos';
          const dateStr = tashkentDateString();
          const dir = path.join(uploadDir, dateStr);
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const user = (req as unknown as { user: JwtUser }).user;
          const ext = path.extname(file.originalname) || '.mp4';
          // Temp name with timestamp — type (morning/evening) determined inside service
          cb(null, `${user.userId}-${Date.now()}${ext}`);
        },
      }),
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: { user: JwtUser },
  ) {
    if (!file) throw new BadRequestException('Video fayl yuborilmagan');

    // Compute relative path from uploadDir base
    const uploadDir = this.uploadDir;
    const absolutePath = file.path;
    const relativePath = path.relative(uploadDir, absolutePath);

    const result = await this.service.recordWebUpload(
      req.user.userId,
      req.user.tenantId,
      { originalname: file.originalname, mimetype: file.mimetype, size: file.size },
      relativePath,
    );

    // Rename file to include morning/evening type now that we know it
    const dateStr = tashkentDateString();
    const ext = path.extname(file.originalname) || '.mp4';
    const finalName = `${req.user.userId}-${result.type}${ext}`;
    const finalAbsPath = path.join(uploadDir, dateStr, finalName);
    const finalRelPath = path.join(dateStr, finalName);

    try {
      // If a same-type file already exists from a previous upload (different
      // timestamp), remove it before renaming.
      if (fs.existsSync(finalAbsPath) && finalAbsPath !== absolutePath) {
        fs.unlinkSync(finalAbsPath);
      }
      fs.renameSync(absolutePath, finalAbsPath);

      // Update DB with the final predictable path
      await this.service.updateVideoPath(result.checkinId, finalRelPath);
    } catch {
      // If rename fails, keep the timestamped name — it's still valid
    }

    return { success: true, type: result.type, status: result.status };
  }

  /**
   * GET /video-checkins/student/:studentId/history?days=30
   */
  @Get('student/:studentId/history')
  @Roles(UserRole.student, UserRole.mentor, UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  async getHistory(
    @Param('studentId') studentId: string,
    @Query('days') daysStr: string,
    @Request() req: { user: JwtUser },
  ) {
    if (req.user.role === UserRole.student && req.user.userId !== studentId) {
      throw new ForbiddenException("Faqat o'zingizning tarixingizni ko'ra olasiz");
    }
    const days = daysStr ? parseInt(daysStr, 10) : 30;
    if (isNaN(days) || days < 1 || days > 365) {
      throw new BadRequestException("days 1-365 oraligida bo'lishi kerak");
    }
    return this.service.getStudentHistory(studentId, days);
  }

  /**
   * GET /video-checkins/student/:studentId/missed-count?since=30
   */
  @Get('student/:studentId/missed-count')
  @Roles(UserRole.student, UserRole.mentor, UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  async getMissedCount(
    @Param('studentId') studentId: string,
    @Query('since') sinceStr: string,
    @Request() req: { user: JwtUser },
  ) {
    if (req.user.role === UserRole.student && req.user.userId !== studentId) {
      throw new ForbiddenException("Faqat o'zingizni tekshira olasiz");
    }
    const since = sinceStr ? parseInt(sinceStr, 10) : 30;
    if (isNaN(since) || since < 1 || since > 365) {
      throw new BadRequestException("since 1-365 oraligida bo'lishi kerak");
    }
    const count = await this.service.getMissedCount(studentId, since);
    return { count };
  }

  /**
   * GET /video-checkins/:id/video
   * Streams the stored video file. Auth-checked in service.
   */
  @Get(':id/video')
  @Roles(UserRole.student, UserRole.mentor, UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  async streamVideo(
    @Param('id') id: string,
    @Request() req: { user: JwtUser },
    @Res() res: Response,
  ) {
    const { absolutePath, mimeType } = await this.service.getVideoFilePath(id, {
      role: req.user.role,
      userId: req.user.userId,
      tenantId: req.user.tenantId,
      branchId: req.user.branchId ?? null,
      groupId: req.user.groupId ?? null,
    });

    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
    });
    // sendFile handles Range requests and efficient streaming
    res.sendFile(absolutePath);
  }
}
