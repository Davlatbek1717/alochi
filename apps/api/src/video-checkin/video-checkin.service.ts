import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { tashkentDateString, dateStringToDate } from './lib/tashkent-time';

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

export interface ReminderRecipient {
  studentId: string;
  telegramId: bigint;
}

export interface PendingWindow {
  studentId: string;
  type: 'morning' | 'evening';
  windowEndsAt: Date;
}

@Injectable()
export class VideoCheckinService {
  private readonly logger = new Logger(VideoCheckinService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    private config: ConfigService,
  ) {}

  /**
   * Auth-checked Telegram video proxy. Resolves the bot's file_id into
   * the actual video bytes for playback in the dashboard. Bot token
   * stays server-side — the caller never sees it.
   *
   * Authorization:
   *  - superadmin: any check-in in their tenant
   *  - filadmin:  any check-in for a student in their branch
   *  - mentor:    any check-in for a student in their group
   *  - student:   their own check-in (so /student/profile can replay)
   */
  async getVideoBytes(
    checkinId: string,
    caller: {
      role: string;
      userId: string;
      tenantId: string;
      branchId: string | null;
      groupId: string | null;
    },
  ): Promise<{ buffer: Buffer; mimeType: string; durationSec: number | null }> {
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
    if (!checkin.telegramFileId) {
      throw new GoneException('Video 2 kundan keyin avtomatik o\'chiriladi');
    }
    const allowed =
      caller.role === 'superadmin' ||
      (caller.role === 'filadmin' &&
        checkin.student.branchId === caller.branchId) ||
      (caller.role === 'manager' &&
        checkin.student.branchId === caller.branchId) ||
      (caller.role === 'mentor' &&
        checkin.student.groupId === caller.groupId) ||
      (caller.role === 'student' && checkin.student.id === caller.userId);
    if (!allowed) throw new ForbiddenException("Ruxsat yo'q");

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new NotFoundException('Bot sozlanmagan');

    // Step 1: resolve file_id → file_path via Telegram getFile.
    const fileInfoRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${checkin.telegramFileId}`,
    );
    const fileInfo = (await fileInfoRes.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };
    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      throw new NotFoundException("Video Telegram'dan o'qib bo'lmadi");
    }

    // Step 2: download the bytes. Round-video and rectangular video
    // both come back as small mp4 (≤ 10 MB for 60s round, more for
    // rect but still bounded by the bot's 90s cap), so we buffer.
    const fileRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`,
    );
    if (!fileRes.ok) {
      throw new NotFoundException("Video yuklab bo'lmadi");
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const mimeType = fileRes.headers.get('content-type') ?? 'video/mp4';
    return { buffer, mimeType, durationSec: checkin.durationSec };
  }

  /**
   * Records a video submission. Upserts so re-sends within the same window
   * update the file reference rather than failing. When `late` is true
   * the row is stored as `status='late'` instead of `'submitted'` so
   * attendance reports can flag the delay.
   *
   * A row that's already `submitted` (on-time) cannot be downgraded to
   * `late` by a subsequent submission — the first on-time submit wins.
   */
  async recordSubmission(
    studentId: string,
    type: 'morning' | 'evening',
    fileId: string,
    kind: 'video_note' | 'video',
    durationSec: number | null,
    late = false,
  ) {
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);

    const status = late ? 'late' : 'submitted';

    // Look up the existing row first so we never downgrade an on-time
    // 'submitted' into 'late' on a late re-submission.
    const existing = await this.prisma.videoCheckin.findUnique({
      where: { studentId_date_type: { studentId, date, type } },
      select: { status: true },
    });
    const finalStatus =
      existing?.status === 'submitted' ? 'submitted' : status;

    const row = await this.prisma.videoCheckin.upsert({
      where: { studentId_date_type: { studentId, date, type } },
      create: {
        studentId,
        date,
        type,
        status: finalStatus,
        telegramFileId: fileId,
        videoKind: kind,
        durationSec,
        submittedAt: new Date(),
      },
      update: {
        status: finalStatus,
        telegramFileId: fileId,
        videoKind: kind,
        durationSec,
        submittedAt: new Date(),
      },
      include: { student: { select: { tenantId: true } } },
    });

    const tenantId = row.student.tenantId;
    this.events.emit('videocheckin.changed', {
      tenantId,
      studentId,
      type,
      status: finalStatus,
    });

    return row;
  }

  /**
   * Marks a single student-window as missed (only if not already submitted).
   * Fires notifications to filadmin(s) + mentor.
   */
  async markMissed(studentId: string, date: Date, type: 'morning' | 'evening') {
    // Skip if already submitted (on-time) or accepted as 'late'.
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
          select: {
            name: true,
            branchId: true,
            groupId: true,
            tenantId: true,
          },
        },
      },
    });

    const student = row.student;
    const tenantId = student.tenantId;
    const typeLabel = type === 'morning' ? 'ertalabki' : 'kechki';
    const notifTitle = 'Video tashlanmadi';
    const notifBody = `${student.name} ${typeLabel} video tashlamadi`;
    const meta = { studentId, type, date: tashkentDateString(date) };

    // Notify all filadmins in the branch
    if (student.branchId) {
      const filadmins = await this.prisma.user.findMany({
        where: {
          role: 'filadmin',
          branchId: student.branchId,
          status: 'active',
        },
        select: { id: true },
      });
      for (const fa of filadmins) {
        await this.prisma.notification
          .create({
            data: {
              userId: fa.id,
              type: 'video_missed',
              title: notifTitle,
              body: notifBody,
              meta,
            },
          })
          .catch(() => undefined);
      }
    }

    // Notify the group's mentor
    if (student.groupId) {
      const mentor = await this.prisma.user.findFirst({
        where: { role: 'mentor', groupId: student.groupId, status: 'active' },
        select: { id: true },
      });
      if (mentor) {
        await this.prisma.notification
          .create({
            data: {
              userId: mentor.id,
              type: 'video_missed',
              title: notifTitle,
              body: notifBody,
              meta,
            },
          })
          .catch(() => undefined);
      }
    }

    this.events.emit('videocheckin.changed', {
      tenantId,
      studentId,
      type,
      status: 'missed',
    });

    return row;
  }

  /**
   * Called at window close time — marks every active student who hasn't
   * submitted as missed in a single pass.
   *
   * `targetDateStr` lets the caller pin the Tashkent calendar date instead
   * of relying on the clock at call time (important for the evening cron
   * which fires at 00:01 of the NEW day).
   */
  async markAllMissedForWindow(type: 'morning' | 'evening', targetDateStr?: string) {
    const dateStr = targetDateStr ?? tashkentDateString();
    const date = dateStringToDate(dateStr);

    this.logger.log(`markAllMissedForWindow: type=${type} date=${dateStr}`);

    // Find all active students across all tenants
    const students = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active' },
      select: { id: true },
    });

    // Find students who already submitted for this window today
    // Anyone with status='submitted' OR 'late' counts as having done it.
    const done = await this.prisma.videoCheckin.findMany({
      where: { date, type, status: { in: ['submitted', 'late'] } },
      select: { studentId: true },
    });
    const doneIds = new Set(done.map((s) => s.studentId));

    let missed = 0;
    for (const student of students) {
      if (doneIds.has(student.id)) continue;
      await this.markMissed(student.id, date, type).catch((err) =>
        this.logger.warn(
          `markMissed failed for ${student.id}: ${(err as Error).message}`,
        ),
      );
      missed++;
    }

    this.logger.log(`markAllMissedForWindow: type=${type} missed=${missed}`);
  }

  /**
   * Dashboard widget data for a branch — one row per active student showing
   * today's morning/evening status.
   */
  async getTodayList(branchId: string): Promise<TodayCheckinRow[]> {
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);
    const now = new Date();

    // Determine which windows are fully closed (on-time AND late grace
    // both expired). A student is only "missed" once both deadlines have
    // passed without a submission.
    const nowTashkent = this.tashkentMinutes(now);
    const morningClosed = nowTashkent >= 1080; // 18:00 — evening opens
    const eveningClosed = nowTashkent === 0; // wraps at midnight; effectively only after the cron stamps a row

    const students = await this.prisma.user.findMany({
      where: { branchId, role: 'student', status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);

    // Fetch today's checkins
    const checkins = await this.prisma.videoCheckin.findMany({
      where: { studentId: { in: studentIds }, date },
    });

    const checkinByStudentType = new Map<string, (typeof checkins)[0]>();
    for (const c of checkins) {
      checkinByStudentType.set(`${c.studentId}:${c.type}`, c);
    }

    // Fetch total missed counts in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const missedCounts = await this.prisma.videoCheckin.groupBy({
      by: ['studentId'],
      where: {
        studentId: { in: studentIds },
        status: 'missed',
        date: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });
    const missedCountMap = new Map(
      missedCounts.map((m) => [m.studentId, m._count.id]),
    );

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
        // Surface ids only when a real video file still exists.
        // telegramFileId is nulled by the nightly prune job after 2 days.
        morningCheckinId:
          (morningRow?.status === 'submitted' || morningRow?.status === 'late') &&
          morningRow?.telegramFileId
            ? morningRow.id
            : null,
        eveningCheckinId:
          (eveningRow?.status === 'submitted' || eveningRow?.status === 'late') &&
          eveningRow?.telegramFileId
            ? eveningRow.id
            : null,
        totalMissedDays: missedCountMap.get(s.id) ?? 0,
      };
    });
  }

  /**
   * Role-aware daily video monitoring for a single Tashkent day.
   * mentor → own group, filadmin/manager → own branch, superadmin →
   * whole tenant. For past days both windows are closed so any
   * non-submitted slot resolves to 'missed'; for today the live
   * window-close times apply (same logic as getTodayList). Future
   * dates are clamped to today.
   */
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
    let dateStr =
      dateParam && re.test(dateParam) ? dateParam : todayStr;
    if (dateStr > todayStr) dateStr = todayStr; // clamp future → today
    const isPast = dateStr < todayStr;
    const date = dateStringToDate(dateStr);

    // Resolve the scoped student set.
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
        studentWhere = {
          role: 'student',
          status: 'active',
          tenantId: requester.tenantId,
          groupId: gid,
        };
        scope = 'group';
      }
    } else if (
      requester.role === 'filadmin' ||
      requester.role === 'manager'
    ) {
      if (requester.branchId) {
        studentWhere = {
          role: 'student',
          status: 'active',
          tenantId: requester.tenantId,
          branchId: requester.branchId,
        };
        scope = 'branch';
      }
    } else if (requester.role === 'superadmin') {
      studentWhere = {
        role: 'student',
        status: 'active',
        tenantId: requester.tenantId,
      };
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

    // Window-close state: past days are fully closed; today uses the
    // live clock (mirrors getTodayList).
    const nowTashkent = this.tashkentMinutes(new Date());
    const morningClosed = isPast || nowTashkent >= 1080;
    const eveningClosed = isPast; // evening only finalises via cron / next day

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
          (m?.status === 'submitted' || m?.status === 'late') && m?.telegramFileId
            ? m.id
            : null,
        eveningCheckinId:
          (e?.status === 'submitted' || e?.status === 'late') && e?.telegramFileId
            ? e.id
            : null,
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

  /** Per-student 30-day history for the detail page. */
  async getStudentHistory(
    studentId: string,
    days = 30,
  ): Promise<StudentHistoryRow[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.videoCheckin.findMany({
      where: { studentId, date: { gte: since } },
      orderBy: { date: 'desc' },
    });

    // Group by date
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
      const videoAvailable = !!r.telegramFileId;
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
   * Returns students who haven't submitted yet for the given window today
   * AND have a telegramId.
   */
  async getReminderRecipients(
    type: 'morning' | 'evening',
  ): Promise<ReminderRecipient[]> {
    const dateStr = tashkentDateString();
    const date = dateStringToDate(dateStr);

    // Exclude both on-time ('submitted') and late ('late') submissions —
    // either means the student already sent a video for this window.
    const submitted = await this.prisma.videoCheckin.findMany({
      where: { date, type, status: { in: ['submitted', 'late'] } },
      select: { studentId: true },
    });
    const submittedIds = new Set(submitted.map((s) => s.studentId));

    const students = await this.prisma.user.findMany({
      where: {
        role: 'student',
        status: 'active',
        telegramId: { not: null },
      },
      select: { id: true, telegramId: true },
    });

    return students
      .filter((s) => !submittedIds.has(s.id) && s.telegramId !== null)
      .map((s) => ({ studentId: s.id, telegramId: s.telegramId! }));
  }

  /**
   * Given a Telegram user ID, returns the current open window info if any.
   * Used by the bot to figure out which slot an incoming video counts for.
   */
  async pendingFromTelegram(telegramId: bigint): Promise<{
    studentId: string;
    type: 'morning' | 'evening';
    windowEndsAt: Date;
  } | null> {
    const student = await this.prisma.user.findFirst({
      where: { telegramId, role: 'student', status: 'active' },
      select: { id: true },
    });
    if (!student) return null;

    const { currentWindowOrLate, tashkentDateString: dateStr } =
      await import('./lib/tashkent-time');
    const slot = currentWindowOrLate();
    if (!slot) return null;

    const dateString = dateStr();
    const date = dateStringToDate(dateString);

    // Check if already submitted for this window. 'submitted' (on-time)
    // is final — student can't resubmit. 'late' rows are also treated
    // as final so a student doesn't keep re-uploading and resetting
    // the late-vs-on-time flag.
    const existing = await this.prisma.videoCheckin.findUnique({
      where: {
        studentId_date_type: { studentId: student.id, date, type: slot.type },
      },
    });
    if (existing?.status === 'submitted' || existing?.status === 'late') {
      return null;
    }

    // Calculate window end time in UTC. For an on-time slot we use the
    // original boundary; for a late slot we use the late-grace cutoff
    // (next-window-opens for morning, midnight for evening).
    const now = new Date();
    const windowEndsAt = new Date();
    const { hour: nowHour, minute: nowMinute } = this.tashkentHourMinuteOf(now);
    const nowTotalMin = nowHour * 60 + nowMinute;

    if (slot.type === 'morning') {
      const tashkentEndMin = slot.late ? 1080 : 390; // 18:00 vs 06:30
      const diffMin = tashkentEndMin - nowTotalMin;
      windowEndsAt.setMinutes(windowEndsAt.getMinutes() + diffMin);
    } else {
      const tashkentEndMin = slot.late ? 1440 : 1320; // 24:00 vs 22:00
      const diffMin = tashkentEndMin - nowTotalMin;
      windowEndsAt.setMinutes(windowEndsAt.getMinutes() + diffMin);
    }

    return { studentId: student.id, type: slot.type, windowEndsAt };
  }

  /**
   * Nightly cleanup: null out telegramFileId for records older than 2 days
   * (keeps today + yesterday). The row itself stays forever for history.
   */
  async pruneOldVideoFiles(): Promise<number> {
    const todayStr = tashkentDateString();
    const today = dateStringToDate(todayStr);
    // Keep today (day 0) and yesterday (day -1). Prune day -2 and older.
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 1); // cutoff = yesterday; lt → day before yesterday and older
    const result = await this.prisma.videoCheckin.updateMany({
      where: { date: { lt: cutoff }, telegramFileId: { not: null } },
      data: { telegramFileId: null },
    });
    this.logger.log(`pruneOldVideoFiles: cleared ${result.count} file IDs`);
    return result.count;
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
      minute: parseInt(
        parts.find((p) => p.type === 'minute')?.value ?? '0',
        10,
      ),
    };
  }
}
