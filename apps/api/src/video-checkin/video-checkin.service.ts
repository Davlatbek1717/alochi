import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { tashkentDateString, dateStringToDate, currentWindowOrLate } from './lib/tashkent-time';

export interface TodayCheckinRow {
  studentId: string;
  name: string;
  morning: 'submitted' | 'late' | 'missed' | 'pending';
  evening: 'submitted' | 'late' | 'missed' | 'pending';
  morningAt: string | null;
  eveningAt: string | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
  totalMissedDays: number;
}

export interface MonitoringResp {
  date: string;
  isPast: boolean;
  scope: 'group' | 'branch' | 'tenant' | 'none';
  summary: {
    students: number;
    morning: { submitted: number; late: number; missed: number; pending: number };
    evening: { submitted: number; late: number; missed: number; pending: number };
  };
  rows: TodayCheckinRow[];
}

export interface StudentHistoryRow {
  date: string;
  morning: string | null;
  evening: string | null;
  morningSubmittedAt: string | null;
  eveningSubmittedAt: string | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
  morningVideoAvailable: boolean;
  eveningVideoAvailable: boolean;
}

export interface TodayWindowStatus {
  canUploadMorning: boolean;
  canUploadEvening: boolean;
  morningStatus: 'submitted' | 'late' | 'missed' | 'pending' | null;
  eveningStatus: 'submitted' | 'late' | 'missed' | 'pending' | null;
  morningCheckinId: string | null;
  eveningCheckinId: string | null;
  morningAt: string | null;
  eveningAt: string | null;
}

@Injectable()
export class VideoCheckinService {
  private readonly logger = new Logger(VideoCheckinService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private config: ConfigService,
  ) {}

  private get uploadDir(): string {
    return this.config.get<string>('VIDEO_UPLOAD_DIR') ?? '/var/www/alochi/uploads/videos';
  }

  private fullPath(videoPath: string): string {
    return path.join(this.uploadDir, videoPath);
  }

  /**
   * Auth-checked video file serve. Reads from local disk and returns
   * a stream-ready absolute file path for the controller to use with
   * Express res.sendFile().
   */
  async getVideoFilePath(
    checkinId: string,
    caller: {
      role: string;
      userId: string;
      tenantId: string;
      branchId: string | null;
      groupId: string | null;
    },
  ): Promise<{ absolutePath?: string; telegramFileId?: string; mimeType: string }> {
    const checkin = await this.prisma.videoCheckin.findFirst({
      where: { id: checkinId, student: { tenantId: caller.tenantId } },
      include: {
        student: {
          select: { tenantId: true, branchId: true, groupId: true, id: true },
        },
      },
    });
    if (!checkin) throw new NotFoundException('Video topilmadi');
    if (checkin.status !== 'submitted' && checkin.status !== 'late') {
      throw new NotFoundException('Bu vaqtga video tashlanmagan');
    }
    if (!checkin.videoPath) {
      throw new GoneException('Video 2 kundan keyin avtomatik o\'chiriladi');
    }

    const allowed =
      caller.role === 'superadmin' ||
      (caller.role === 'filadmin' && checkin.student.branchId === caller.branchId) ||
      (caller.role === 'manager' && checkin.student.branchId === caller.branchId) ||
      (caller.role === 'mentor' && checkin.student.groupId === caller.groupId) ||
      (caller.role === 'student' && checkin.student.id === caller.userId);
    if (!allowed) throw new ForbiddenException("Ruxsat yo'q");

    // Legacy videos uploaded via the Telegram bot stored the Telegram
    // file_id in videoPath (no path separator). Serve those by proxying
    // from Telegram; locally-uploaded videos always contain a "/".
    if (!checkin.videoPath.includes('/')) {
      return { telegramFileId: checkin.videoPath, mimeType: 'video/mp4' };
    }

    const absolutePath = this.fullPath(checkin.videoPath);
    if (!fs.existsSync(absolutePath)) {
      throw new GoneException('Video fayl topilmadi');
    }

    const ext = path.extname(checkin.videoPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
    };
    const mimeType = mimeMap[ext] ?? 'video/mp4';

    return { absolutePath, mimeType };
  }

  /**
   * Saves an uploaded video file and upserts the VideoCheckin record.
   * Called by the upload endpoint. Window is detected from current Tashkent time
   * unless the caller explicitly passes a type override (for testing).
   */
  async recordWebUpload(
    studentId: string,
    tenantId: string,
    file: { originalname: string; mimetype: string; size: number },
    savedRelativePath: string,
    typeOverride?: 'morning' | 'evening',
  ): Promise<{ checkinId: string; status: string; type: string }> {
    const slot = typeOverride
      ? { type: typeOverride, late: false }
      : currentWindowOrLate();

    if (!slot) {
      // Outside any window — delete the uploaded file and reject
      try { fs.unlinkSync(this.fullPath(savedRelativePath)); } catch { /* ignore */ }
      throw new BadRequestException(
        'Hozir video yuklash vaqti emas. Ertalab 05:00–06:30 yoki kechki 18:00–22:00 da yuboring.',
      );
    }

    const { type, late } = slot;
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);
    const status = late ? 'late' : 'submitted';

    // Don't downgrade on-time to late on resubmit
    const existing = await this.prisma.videoCheckin.findUnique({
      where: { studentId_date_type: { studentId, date, type } },
      select: { status: true, videoPath: true },
    });
    const finalStatus = existing?.status === 'submitted' ? 'submitted' : status;

    // Delete old video file if it exists (student resubmitting)
    if (existing?.videoPath) {
      const oldPath = this.fullPath(existing.videoPath);
      try { fs.unlinkSync(oldPath); } catch { /* already gone */ }
    }

    const row = await this.prisma.videoCheckin.upsert({
      where: { studentId_date_type: { studentId, date, type } },
      create: {
        studentId,
        date,
        type,
        status: finalStatus,
        videoPath: savedRelativePath,
        submittedAt: new Date(),
      },
      update: {
        status: finalStatus,
        videoPath: savedRelativePath,
        submittedAt: new Date(),
      },
      include: { student: { select: { tenantId: true } } },
    });

    this.events.emit('videocheckin.changed', {
      tenantId,
      studentId,
      type,
      status: finalStatus,
    });

    return { checkinId: row.id, status: finalStatus, type };
  }

  /**
   * Returns the current student's today upload status + whether upload is allowed now.
   */
  async getTodayStatusForStudent(studentId: string): Promise<TodayWindowStatus> {
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);

    const checkins = await this.prisma.videoCheckin.findMany({
      where: { studentId, date },
      select: { type: true, status: true, submittedAt: true, id: true, videoPath: true },
    });

    const morning = checkins.find((c) => c.type === 'morning');
    const evening = checkins.find((c) => c.type === 'evening');

    const slot = currentWindowOrLate();
    const canUploadMorning =
      (!morning || (morning.status !== 'submitted' && morning.status !== 'late')) &&
      (slot?.type === 'morning');
    const canUploadEvening =
      (!evening || (evening.status !== 'submitted' && evening.status !== 'late')) &&
      (slot?.type === 'evening');

    return {
      canUploadMorning,
      canUploadEvening,
      morningStatus: morning?.status as TodayWindowStatus['morningStatus'] ?? null,
      eveningStatus: evening?.status as TodayWindowStatus['eveningStatus'] ?? null,
      morningCheckinId:
        (morning?.status === 'submitted' || morning?.status === 'late') && morning?.videoPath
          ? morning.id
          : null,
      eveningCheckinId:
        (evening?.status === 'submitted' || evening?.status === 'late') && evening?.videoPath
          ? evening.id
          : null,
      morningAt: morning?.submittedAt?.toISOString() ?? null,
      eveningAt: evening?.submittedAt?.toISOString() ?? null,
    };
  }

  /**
   * Marks a single student-window as missed (only if not already submitted).
   * Fires notifications to filadmin(s) + mentor.
   */
  async markMissed(studentId: string, date: Date, type: 'morning' | 'evening') {
    const existing = await this.prisma.videoCheckin.findUnique({
      where: { studentId_date_type: { studentId, date, type } },
    });
    if (existing?.status === 'submitted' || existing?.status === 'late') return;

    const row = await this.prisma.videoCheckin.upsert({
      where: { studentId_date_type: { studentId, date, type } },
      create: { studentId, date, type, status: 'missed' },
      update: { status: 'missed' },
      include: {
        student: {
          select: { name: true, branchId: true, groupId: true, tenantId: true },
        },
      },
    });

    const student = row.student;
    const tenantId = student.tenantId;
    const typeLabel = type === 'morning' ? 'ertalabki' : 'kechki';
    const notifTitle = 'Video tashlanmadi';
    const notifBody = `${student.name} ${typeLabel} video tashlamadi`;
    const meta = { studentId, type, date: tashkentDateString(date) };

    if (student.branchId) {
      const filadmins = await this.prisma.user.findMany({
        where: { role: 'filadmin', branchId: student.branchId, status: 'active' },
        select: { id: true },
      });
      for (const fa of filadmins) {
        await this.prisma.notification
          .create({ data: { userId: fa.id, type: 'video_missed', title: notifTitle, body: notifBody, meta } })
          .catch(() => undefined);
      }
    }

    if (student.groupId) {
      const mentor = await this.prisma.user.findFirst({
        where: { role: 'mentor', groupId: student.groupId, status: 'active' },
        select: { id: true },
      });
      if (mentor) {
        await this.prisma.notification
          .create({ data: { userId: mentor.id, type: 'video_missed', title: notifTitle, body: notifBody, meta } })
          .catch(() => undefined);
      }
    }

    this.events.emit('videocheckin.changed', { tenantId, studentId, type, status: 'missed' });
    return row;
  }

  /**
   * Marks all active students who haven't submitted as missed for the given window.
   */
  async markAllMissedForWindow(type: 'morning' | 'evening', targetDateStr?: string) {
    const dateStr = targetDateStr ?? tashkentDateString();
    const date = dateStringToDate(dateStr);

    this.logger.log(`markAllMissedForWindow: type=${type} date=${dateStr}`);

    const students = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active' },
      select: { id: true },
    });

    const done = await this.prisma.videoCheckin.findMany({
      where: { date, type, status: { in: ['submitted', 'late'] } },
      select: { studentId: true },
    });
    const doneIds = new Set(done.map((s) => s.studentId));

    let missed = 0;
    for (const student of students) {
      if (doneIds.has(student.id)) continue;
      await this.markMissed(student.id, date, type).catch((err) =>
        this.logger.warn(`markMissed failed for ${student.id}: ${(err as Error).message}`),
      );
      missed++;
    }

    this.logger.log(`markAllMissedForWindow: type=${type} missed=${missed}`);
  }

  /** Dashboard widget data for a branch. */
  async getTodayList(branchId: string): Promise<TodayCheckinRow[]> {
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);
    const now = new Date();

    const nowTashkent = this.tashkentMinutes(now);
    const morningClosed = nowTashkent >= 1080;
    const eveningClosed = nowTashkent === 0;

    const students = await this.prisma.user.findMany({
      where: { branchId, role: 'student', status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);

    const checkins = await this.prisma.videoCheckin.findMany({
      where: { studentId: { in: studentIds }, date },
    });

    const checkinByStudentType = new Map<string, (typeof checkins)[0]>();
    for (const c of checkins) {
      checkinByStudentType.set(`${c.studentId}:${c.type}`, c);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const missedCounts = await this.prisma.videoCheckin.groupBy({
      by: ['studentId'],
      where: { studentId: { in: studentIds }, status: 'missed', date: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });
    const missedCountMap = new Map(missedCounts.map((m) => [m.studentId, m._count.id]));

    return students.map((s) => {
      const morningRow = checkinByStudentType.get(`${s.id}:morning`);
      const eveningRow = checkinByStudentType.get(`${s.id}:evening`);

      const resolveMorning = (): 'submitted' | 'late' | 'missed' | 'pending' => {
        if (morningRow?.status === 'submitted') return 'submitted';
        if (morningRow?.status === 'late') return 'late';
        if (morningRow?.status === 'missed') return 'missed';
        return morningClosed ? 'missed' : 'pending';
      };

      const resolveEvening = (): 'submitted' | 'late' | 'missed' | 'pending' => {
        if (eveningRow?.status === 'submitted') return 'submitted';
        if (eveningRow?.status === 'late') return 'late';
        if (eveningRow?.status === 'missed') return 'missed';
        return eveningClosed ? 'missed' : 'pending';
      };

      return {
        studentId: s.id,
        name: s.name,
        morning: resolveMorning(),
        evening: resolveEvening(),
        morningAt: morningRow?.submittedAt?.toISOString() ?? null,
        eveningAt: eveningRow?.submittedAt?.toISOString() ?? null,
        morningCheckinId:
          (morningRow?.status === 'submitted' || morningRow?.status === 'late') && morningRow?.videoPath
            ? morningRow.id
            : null,
        eveningCheckinId:
          (eveningRow?.status === 'submitted' || eveningRow?.status === 'late') && eveningRow?.videoPath
            ? eveningRow.id
            : null,
        totalMissedDays: missedCountMap.get(s.id) ?? 0,
      };
    });
  }

  /** Role-aware daily monitoring. */
  async getMonitoring(
    requester: {
      userId: string;
      role: string;
      tenantId: string;
      branchId?: string | null;
      groupId?: string | null;
    },
    dateParam?: string,
  ): Promise<MonitoringResp> {
    const todayStr = tashkentDateString();
    const re = /^\d{4}-\d{2}-\d{2}$/;
    let dateStr = dateParam && re.test(dateParam) ? dateParam : todayStr;
    if (dateStr > todayStr) dateStr = todayStr;
    const isPast = dateStr < todayStr;
    const date = dateStringToDate(dateStr);

    let studentWhere:
      | { role: 'student'; status: 'active'; tenantId: string; groupId?: string; branchId?: string }
      | null = null;
    let scope: MonitoringResp['scope'] = 'none';

    if (requester.role === 'mentor') {
      const mentor = await this.prisma.user.findUnique({
        where: { id: requester.userId },
        select: { groupId: true },
      });
      const gid = mentor?.groupId ?? requester.groupId ?? null;
      if (gid) {
        studentWhere = { role: 'student', status: 'active', tenantId: requester.tenantId, groupId: gid };
        scope = 'group';
      }
    } else if (requester.role === 'filadmin' || requester.role === 'manager') {
      if (requester.branchId) {
        studentWhere = { role: 'student', status: 'active', tenantId: requester.tenantId, branchId: requester.branchId };
        scope = 'branch';
      }
    } else if (requester.role === 'superadmin') {
      studentWhere = { role: 'student', status: 'active', tenantId: requester.tenantId };
      scope = 'tenant';
    }

    const empty: MonitoringResp = {
      date: dateStr,
      isPast,
      scope,
      summary: {
        students: 0,
        morning: { submitted: 0, late: 0, missed: 0, pending: 0 },
        evening: { submitted: 0, late: 0, missed: 0, pending: 0 },
      },
      rows: [],
    };
    if (!studentWhere) return { ...empty, scope: 'none' };

    const students = await this.prisma.user.findMany({
      where: studentWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (students.length === 0) return empty;
    const studentIds = students.map((s) => s.id);

    const checkins = await this.prisma.videoCheckin.findMany({
      where: { studentId: { in: studentIds }, date },
    });
    const byKey = new Map<string, (typeof checkins)[0]>();
    for (const c of checkins) byKey.set(`${c.studentId}:${c.type}`, c);

    const nowTashkent = this.tashkentMinutes(new Date());
    const morningClosed = isPast || nowTashkent >= 1080;
    const eveningClosed = isPast;

    const summary = {
      students: students.length,
      morning: { submitted: 0, late: 0, missed: 0, pending: 0 },
      evening: { submitted: 0, late: 0, missed: 0, pending: 0 },
    };

    const resolve = (
      row: (typeof checkins)[0] | undefined,
      closed: boolean,
    ): 'submitted' | 'late' | 'missed' | 'pending' => {
      if (row?.status === 'submitted') return 'submitted';
      if (row?.status === 'late') return 'late';
      if (row?.status === 'missed') return 'missed';
      return closed ? 'missed' : 'pending';
    };

    const rows: TodayCheckinRow[] = students.map((s) => {
      const m = byKey.get(`${s.id}:morning`);
      const e = byKey.get(`${s.id}:evening`);
      const mStatus = resolve(m, morningClosed);
      const eStatus = resolve(e, eveningClosed);
      summary.morning[mStatus]++;
      summary.evening[eStatus]++;
      return {
        studentId: s.id,
        name: s.name,
        morning: mStatus,
        evening: eStatus,
        morningAt: m?.submittedAt?.toISOString() ?? null,
        eveningAt: e?.submittedAt?.toISOString() ?? null,
        morningCheckinId:
          (m?.status === 'submitted' || m?.status === 'late') && m?.videoPath ? m.id : null,
        eveningCheckinId:
          (e?.status === 'submitted' || e?.status === 'late') && e?.videoPath ? e.id : null,
        totalMissedDays: 0,
      };
    });

    return { date: dateStr, isPast, scope, summary, rows };
  }

  /** Number of missed checkins in the past N days for a student. */
  async getMissedCount(studentId: string, sinceDays = 30): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    return this.prisma.videoCheckin.count({
      where: { studentId, status: 'missed', date: { gte: since } },
    });
  }

  /** Per-student 30-day history. */
  async getStudentHistory(studentId: string, days = 30): Promise<StudentHistoryRow[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.videoCheckin.findMany({
      where: { studentId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });

    const byDate = new Map<string, StudentHistoryRow>();
    for (const r of rows) {
      const dateKey = tashkentDateString(r.date);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          morning: null,
          evening: null,
          morningSubmittedAt: null,
          eveningSubmittedAt: null,
          morningCheckinId: null,
          eveningCheckinId: null,
          morningVideoAvailable: false,
          eveningVideoAvailable: false,
        });
      }
      const entry = byDate.get(dateKey)!;
      const videoAvailable = !!r.videoPath;
      if (r.type === 'morning') {
        entry.morning = r.status;
        entry.morningSubmittedAt = r.submittedAt?.toISOString() ?? null;
        entry.morningCheckinId =
          (r.status === 'submitted' || r.status === 'late') && videoAvailable ? r.id : null;
        entry.morningVideoAvailable = videoAvailable;
      } else {
        entry.evening = r.status;
        entry.eveningSubmittedAt = r.submittedAt?.toISOString() ?? null;
        entry.eveningCheckinId =
          (r.status === 'submitted' || r.status === 'late') && videoAvailable ? r.id : null;
        entry.eveningVideoAvailable = videoAvailable;
      }
    }

    return Array.from(byDate.values());
  }

  /**
   * Nightly cleanup: delete video files and null video_path for records
   * older than yesterday (keeps today + yesterday). Row stays forever.
   */
  async pruneOldVideoFiles(): Promise<number> {
    const todayStr = tashkentDateString();
    const today = dateStringToDate(todayStr);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 1); // lt cutoff = day before yesterday and older

    const toDelete = await this.prisma.videoCheckin.findMany({
      where: { date: { lt: cutoff }, videoPath: { not: null } },
      select: { id: true, videoPath: true },
    });

    let deletedFiles = 0;
    for (const row of toDelete) {
      if (!row.videoPath) continue;
      try {
        fs.unlinkSync(this.fullPath(row.videoPath));
        deletedFiles++;
      } catch {
        // File already gone — ignore
      }
    }

    const result = await this.prisma.videoCheckin.updateMany({
      where: { date: { lt: cutoff }, videoPath: { not: null } },
      data: { videoPath: null },
    });

    this.logger.log(`pruneOldVideoFiles: deleted ${deletedFiles} files, cleared ${result.count} DB rows`);
    return result.count;
  }

  /** Update the video_path after the file has been renamed on disk. */
  async updateVideoPath(checkinId: string, videoPath: string): Promise<void> {
    await this.prisma.videoCheckin.update({
      where: { id: checkinId },
      data: { videoPath },
    });
  }

  private tashkentMinutes(date: Date): number {
    const { hour, minute } = this.tashkentHourMinuteOf(date);
    return hour * 60 + minute;
  }

  private tashkentHourMinuteOf(date: Date): { hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tashkent',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    return {
      hour: parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10),
      minute: parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10),
    };
  }
}
