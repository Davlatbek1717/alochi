import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  tashkentDateString,
  dateStringToDate,
} from '../video-checkin/lib/tashkent-time';

/**
 * Daily study-time accounting.
 *
 * The web client sends a heartbeat (`POST /study-time/ping`) roughly every
 * 60s while the student is *actively* on a counted route (lesson runner,
 * daily review, translate tool) with the tab visible and not idle.
 *
 * The server is the single source of truth and clamps aggressively so the
 * counter cannot be inflated:
 *   - a single ping never adds more than MAX_PING_SECONDS,
 *   - never more than the real wall-clock elapsed since the last ping,
 *   - the daily total is capped at MAX_DAILY_SECONDS.
 *
 * One row per student per Tashkent calendar day (00:00–24:00).
 */
@Injectable()
export class StudyTimeService {
  private readonly MAX_PING_SECONDS = 90;
  private readonly MAX_DAILY_SECONDS = 12 * 3600;

  constructor(private prisma: PrismaService) {}

  // ── Session policy (superadmin-tunable, SiteSetting key/value) ──────
  private readonly POLICY_KEYS = {
    cap: 'study.dailyCapMinutes',
    block: 'study.workBlockMinutes',
    brk: 'study.breakMinutes',
  };

  /** Daily cap + work-block + forced-break minutes. 0 cap = no limit. */
  async getPolicy(): Promise<{
    dailyCapMinutes: number;
    workBlockMinutes: number;
    breakMinutes: number;
  }> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: Object.values(this.POLICY_KEYS) } },
    });
    const m = new Map(rows.map((r) => [r.key, parseInt(r.value, 10)]));
    const num = (k: string, def: number) => {
      const v = m.get(k);
      return Number.isFinite(v) && (v as number) >= 0 ? (v as number) : def;
    };
    return {
      dailyCapMinutes: num(this.POLICY_KEYS.cap, 300), // 5h default
      workBlockMinutes: num(this.POLICY_KEYS.block, 60),
      breakMinutes: num(this.POLICY_KEYS.brk, 15),
    };
  }

  /** Superadmin sets the policy (clamped to sane ranges). */
  async setPolicy(p: {
    dailyCapMinutes?: number;
    workBlockMinutes?: number;
    breakMinutes?: number;
  }): Promise<{
    dailyCapMinutes: number;
    workBlockMinutes: number;
    breakMinutes: number;
  }> {
    const clamp = (v: unknown, lo: number, hi: number, def: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
    };
    const cur = await this.getPolicy();
    const next = {
      [this.POLICY_KEYS.cap]:
        p.dailyCapMinutes !== undefined
          ? clamp(p.dailyCapMinutes, 0, 720, cur.dailyCapMinutes)
          : cur.dailyCapMinutes,
      [this.POLICY_KEYS.block]:
        p.workBlockMinutes !== undefined
          ? clamp(p.workBlockMinutes, 5, 240, cur.workBlockMinutes)
          : cur.workBlockMinutes,
      [this.POLICY_KEYS.brk]:
        p.breakMinutes !== undefined
          ? clamp(p.breakMinutes, 0, 120, cur.breakMinutes)
          : cur.breakMinutes,
    };
    for (const [key, value] of Object.entries(next)) {
      await this.prisma.siteSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
    }
    return {
      dailyCapMinutes: next[this.POLICY_KEYS.cap],
      workBlockMinutes: next[this.POLICY_KEYS.block],
      breakMinutes: next[this.POLICY_KEYS.brk],
    };
  }

  /**
   * Read-only session gate — used by the client SessionGuard to decide
   * whether the student may study now (no accrual, no writes).
   */
  async getGate(userId: string): Promise<{
    state: 'ok' | 'break' | 'cap';
    secondsToday: number;
    dailyCapMinutes: number;
    blockSecondsLeft: number;
    breakEndsAt: string | null;
  }> {
    const dateObj = dateStringToDate(tashkentDateString());
    const [row, policy] = await Promise.all([
      this.prisma.studyTimeDaily.findUnique({
        where: { studentId_date: { studentId: userId, date: dateObj } },
      }),
      this.getPolicy(),
    ]);
    const capSec = policy.dailyCapMinutes * 60;
    const blockSec = policy.workBlockMinutes * 60;
    const now = Date.now();
    const seconds = row?.seconds ?? 0;

    if (row?.capReachedAt || (capSec > 0 && seconds >= capSec)) {
      return {
        state: 'cap',
        secondsToday: seconds,
        dailyCapMinutes: policy.dailyCapMinutes,
        blockSecondsLeft: 0,
        breakEndsAt: null,
      };
    }
    if (row?.breakUntil && now < row.breakUntil.getTime()) {
      return {
        state: 'break',
        secondsToday: seconds,
        dailyCapMinutes: policy.dailyCapMinutes,
        blockSecondsLeft: 0,
        breakEndsAt: row.breakUntil.toISOString(),
      };
    }
    const blockElapsed = row?.blockStartedAt
      ? Math.floor((now - row.blockStartedAt.getTime()) / 1000)
      : 0;
    return {
      state: 'ok',
      secondsToday: seconds,
      dailyCapMinutes: policy.dailyCapMinutes,
      blockSecondsLeft: Math.max(0, blockSec - blockElapsed),
      breakEndsAt: null,
    };
  }

  /**
   * Heartbeat. Accrues active seconds AND drives the session engine:
   * after each `workBlockMinutes` of continuous study the student is
   * forced into a `breakMinutes` break; at `dailyCapMinutes` they're
   * locked for the rest of the Tashkent day. Returns the session state
   * so the client can show a countdown / force logout.
   */
  async recordPing(
    user: { userId: string; tenantId: string; branchId?: string | null },
    body: { deltaSeconds?: number },
  ): Promise<{
    counted: boolean;
    secondsToday: number;
    state: 'ok' | 'break' | 'cap';
    blockSecondsLeft: number;
    breakEndsAt: string | null;
    dailyCapMinutes: number;
  }> {
    const today = tashkentDateString();
    const dateObj = dateStringToDate(today);
    const policy = await this.getPolicy();
    const capSec = policy.dailyCapMinutes * 60;
    const blockSec = policy.workBlockMinutes * 60;
    const breakMs = policy.breakMinutes * 60 * 1000;
    const now = new Date();

    const existing = await this.prisma.studyTimeDaily.findUnique({
      where: { studentId_date: { studentId: user.userId, date: dateObj } },
    });

    const stateResp = (
      state: 'ok' | 'break' | 'cap',
      seconds: number,
      blockStartedAt: Date | null,
      breakUntil: Date | null,
    ) => ({
      counted: false,
      secondsToday: seconds,
      state,
      blockSecondsLeft:
        state === 'ok' && blockStartedAt
          ? Math.max(
              0,
              blockSec -
                Math.floor((now.getTime() - blockStartedAt.getTime()) / 1000),
            )
          : state === 'ok'
            ? blockSec
            : 0,
      breakEndsAt: breakUntil ? breakUntil.toISOString() : null,
      dailyCapMinutes: policy.dailyCapMinutes,
    });

    // Already capped / mid-break — never accrue, just report the lock.
    if (existing) {
      if (existing.capReachedAt || (capSec > 0 && existing.seconds >= capSec)) {
        if (!existing.capReachedAt) {
          await this.prisma.studyTimeDaily.update({
            where: { id: existing.id },
            data: { capReachedAt: now },
          });
        }
        return {
          ...stateResp('cap', existing.seconds, null, null),
        };
      }
      if (existing.breakUntil && now.getTime() < existing.breakUntil.getTime()) {
        return stateResp(
          'break',
          existing.seconds,
          null,
          existing.breakUntil,
        );
      }
    }

    const rawDelta = Number(body.deltaSeconds);
    const delta =
      Number.isFinite(rawDelta) && rawDelta > 0
        ? Math.min(rawDelta, this.MAX_PING_SECONDS)
        : 0;

    if (existing) {
      const wallclock = (now.getTime() - existing.lastPingAt.getTime()) / 1000;
      const effective = Math.round(
        Math.max(0, Math.min(delta, wallclock, this.MAX_PING_SECONDS)),
      );
      const seconds = Math.min(
        existing.seconds + effective,
        this.MAX_DAILY_SECONDS,
      );
      // A finished break restarts the work block fresh.
      const breakJustEnded =
        existing.breakUntil != null &&
        now.getTime() >= existing.breakUntil.getTime();
      let blockStartedAt: Date | null = breakJustEnded
        ? now
        : (existing.blockStartedAt ?? now);
      let breakUntil: Date | null = breakJustEnded ? null : null;
      let capReachedAt: Date | null = null;
      let state: 'ok' | 'break' | 'cap' = 'ok';

      if (capSec > 0 && seconds >= capSec) {
        capReachedAt = now;
        state = 'cap';
        blockStartedAt = null;
      } else if (
        blockSec > 0 &&
        now.getTime() - blockStartedAt.getTime() >= blockSec * 1000
      ) {
        breakUntil = breakMs > 0 ? new Date(now.getTime() + breakMs) : null;
        state = breakMs > 0 ? 'break' : 'ok';
        blockStartedAt = breakMs > 0 ? null : now;
      }

      await this.prisma.studyTimeDaily.update({
        where: { id: existing.id },
        data: {
          seconds,
          lastPingAt: now,
          blockStartedAt,
          breakUntil,
          capReachedAt,
        },
      });
      return {
        ...stateResp(state, seconds, blockStartedAt, breakUntil),
        counted: effective > 0,
      };
    }

    // First ping of the day — open a fresh block.
    const effective = Math.round(
      Math.max(0, Math.min(delta, this.MAX_PING_SECONDS)),
    );
    try {
      const created = await this.prisma.studyTimeDaily.create({
        data: {
          studentId: user.userId,
          tenantId: user.tenantId,
          branchId: user.branchId ?? null,
          date: dateObj,
          seconds: effective,
          lastPingAt: now,
          blockStartedAt: now,
        },
      });
      return {
        ...stateResp('ok', created.seconds, now, null),
        counted: effective > 0,
      };
    } catch {
      const row = await this.prisma.studyTimeDaily.findUnique({
        where: { studentId_date: { studentId: user.userId, date: dateObj } },
      });
      if (!row) {
        return stateResp('ok', 0, now, null);
      }
      const seconds = Math.min(
        row.seconds + effective,
        this.MAX_DAILY_SECONDS,
      );
      await this.prisma.studyTimeDaily.update({
        where: { id: row.id },
        data: { seconds, lastPingAt: now },
      });
      return {
        ...stateResp(
          'ok',
          seconds,
          row.blockStartedAt ?? now,
          null,
        ),
        counted: effective > 0,
      };
    }
  }

  /** The requesting student's own minutes today + the branch requirement. */
  async myToday(user: {
    userId: string;
    branchId?: string | null;
  }): Promise<{ minutes: number; thresholdMinutes: number }> {
    const dateObj = dateStringToDate(tashkentDateString());
    const [row, branch] = await Promise.all([
      this.prisma.studyTimeDaily.findUnique({
        where: { studentId_date: { studentId: user.userId, date: dateObj } },
        select: { seconds: true },
      }),
      user.branchId
        ? this.prisma.branch.findUnique({
            where: { id: user.branchId },
            select: { minDailyStudyMinutes: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      minutes: Math.floor((row?.seconds ?? 0) / 60),
      thresholdMinutes: branch?.minDailyStudyMinutes ?? 0,
    };
  }

  /**
   * Filadmin view: every student in the filadmin's branch with today's
   * study minutes and a `below` flag (minutes < branch threshold). The
   * threshold of 0 means "no requirement" — nothing is flagged.
   */
  async branchToday(user: {
    tenantId: string;
    branchId?: string | null;
  }): Promise<{
    date: string;
    thresholdMinutes: number;
    belowCount: number;
    students: {
      id: string;
      name: string;
      login: string;
      minutes: number;
      below: boolean;
    }[];
  }> {
    const today = tashkentDateString();
    const dateObj = dateStringToDate(today);

    if (!user.branchId) {
      return { date: today, thresholdMinutes: 0, belowCount: 0, students: [] };
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: user.branchId, tenantId: user.tenantId },
      select: { minDailyStudyMinutes: true },
    });
    const thresholdMinutes = branch?.minDailyStudyMinutes ?? 0;

    const [students, rows] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: 'student',
          branchId: user.branchId,
          tenantId: user.tenantId,
        },
        select: { id: true, name: true, login: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.studyTimeDaily.findMany({
        where: { date: dateObj, student: { branchId: user.branchId } },
        select: { studentId: true, seconds: true },
      }),
    ]);

    const secondsByStudent = new Map<string, number>();
    for (const r of rows) secondsByStudent.set(r.studentId, r.seconds);

    let belowCount = 0;
    const list = students.map((s) => {
      const minutes = Math.floor((secondsByStudent.get(s.id) ?? 0) / 60);
      const below = thresholdMinutes > 0 && minutes < thresholdMinutes;
      if (below) belowCount++;
      return {
        id: s.id,
        name: s.name,
        login: s.login,
        minutes,
        below,
      };
    });

    return { date: today, thresholdMinutes, belowCount, students: list };
  }

  /**
   * Last `days` (1–30) of a single student's study minutes, oldest→newest,
   * with zero-filled gaps. Access is scoped: superadmin anywhere; filadmin
   * /manager to their branch; mentor to their own group.
   */
  async studentHistory(
    requester: {
      userId: string;
      role: string;
      tenantId: string;
      branchId?: string | null;
    },
    studentId: string,
    daysParam?: number,
  ): Promise<{
    studentId: string;
    thresholdMinutes: number;
    days: { date: string; minutes: number }[];
  }> {
    const days = Math.max(1, Math.min(30, Math.round(daysParam || 7)));

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        tenantId: true,
        branchId: true,
        groupId: true,
      },
    });
    if (
      !student ||
      student.role !== 'student' ||
      student.tenantId !== requester.tenantId
    ) {
      throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
    }

    if (requester.role === 'superadmin') {
      // allowed anywhere within the tenant
    } else if (
      requester.role === 'filadmin' ||
      requester.role === 'manager'
    ) {
      if (!requester.branchId || student.branchId !== requester.branchId) {
        throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
      }
    } else if (requester.role === 'mentor') {
      const mentor = await this.prisma.user.findUnique({
        where: { id: requester.userId },
        select: { groupId: true },
      });
      if (!mentor?.groupId || student.groupId !== mentor.groupId) {
        throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
      }
    } else {
      throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
    }

    // Build the Tashkent-calendar date window (oldest → newest).
    const dateStrings: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dateStrings.push(
        tashkentDateString(new Date(Date.now() - i * 86400000)),
      );
    }

    const rows = await this.prisma.studyTimeDaily.findMany({
      where: {
        studentId,
        date: { in: dateStrings.map((d) => dateStringToDate(d)) },
      },
      select: { date: true, seconds: true },
    });
    const minutesByDate = new Map<string, number>();
    for (const r of rows) {
      // r.date is a @db.Date — its ISO yyyy-mm-dd prefix is the key.
      const key = r.date.toISOString().slice(0, 10);
      minutesByDate.set(key, Math.floor(r.seconds / 60));
    }

    const branch = student.branchId
      ? await this.prisma.branch.findUnique({
          where: { id: student.branchId },
          select: { minDailyStudyMinutes: true },
        })
      : null;

    return {
      studentId,
      thresholdMinutes: branch?.minDailyStudyMinutes ?? 0,
      days: dateStrings.map((d) => ({
        date: d,
        minutes: minutesByDate.get(d) ?? 0,
      })),
    };
  }

  /**
   * One student's activity timeline for a single Tashkent calendar day.
   * Same role-scoping as studentHistory (superadmin tenant-wide; filadmin
   * /manager → own branch; mentor → own group). Built only from real
   * signals — analytics events (lessons, streak, attendance), video
   * check-ins, completed duels and the day's study minutes — so an idle
   * day legitimately shows an empty timeline rather than synthetic filler.
   */
  async studentActivity(
    requester: {
      userId: string;
      role: string;
      tenantId: string;
      branchId?: string | null;
    },
    studentId: string,
    dateParam?: string,
  ): Promise<{
    date: string;
    summary: {
      studyMinutes: number;
      morningVideo: 'submitted' | 'late' | 'missed' | 'none';
      eveningVideo: 'submitted' | 'late' | 'missed' | 'none';
    };
    events: { at: string; type: string; label: string }[];
    duels: {
      at: string;
      opponent: string;
      result: 'win' | 'loss' | 'draw';
      score: string;
    }[];
  }> {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const dateStr = re.test(dateParam ?? '')
      ? (dateParam as string)
      : tashkentDateString();

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        tenantId: true,
        branchId: true,
        groupId: true,
      },
    });
    if (
      !student ||
      student.role !== 'student' ||
      student.tenantId !== requester.tenantId
    ) {
      throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
    }

    if (requester.role === 'superadmin') {
      // tenant-wide
    } else if (
      requester.role === 'filadmin' ||
      requester.role === 'manager'
    ) {
      if (!requester.branchId || student.branchId !== requester.branchId) {
        throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
      }
    } else if (requester.role === 'mentor') {
      const mentor = await this.prisma.user.findUnique({
        where: { id: requester.userId },
        select: { groupId: true },
      });
      if (!mentor?.groupId || student.groupId !== mentor.groupId) {
        throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
      }
    } else {
      throw new ForbiddenException('Bu oʻquvchiga ruxsat yoʻq');
    }

    // UTC bounds of the Tashkent calendar day (UTC+5, no DST). The
    // @db.Date columns use dateStringToDate directly; the timestamp
    // columns (analytics, duels) need the shifted UTC window.
    const TZ_OFFSET_MS = 5 * 3600 * 1000;
    const dateObj = dateStringToDate(dateStr);
    const dayStart = new Date(dateObj.getTime() - TZ_OFFSET_MS);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const [studyRow, videos, rawEvents, duels] = await Promise.all([
      this.prisma.studyTimeDaily.findUnique({
        where: { studentId_date: { studentId, date: dateObj } },
        select: { seconds: true },
      }),
      this.prisma.videoCheckin.findMany({
        where: { studentId, date: dateObj },
        select: { type: true, status: true },
      }),
      this.prisma.analyticsEvent.findMany({
        where: {
          studentId,
          tenantId: requester.tenantId,
          createdAt: { gte: dayStart, lt: dayEnd },
          eventType: {
            in: [
              'lesson_completed',
              'lesson_failed',
              'streak_updated',
              'attendance_marked',
            ],
          },
        },
        select: { eventType: true, data: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.duel.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: dayStart, lt: dayEnd },
          OR: [{ challengerId: studentId }, { challengedId: studentId }],
        },
        select: {
          challengerId: true,
          challengedId: true,
          challengerScore: true,
          challengedScore: true,
          winnerId: true,
          createdAt: true,
          challenger: { select: { name: true } },
          challenged: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const asObj = (v: unknown): Record<string, unknown> =>
      v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

    // Resolve lesson title + order for lesson events in one batch.
    const lessonIds = Array.from(
      new Set(
        rawEvents
          .filter(
            (e) =>
              e.eventType === 'lesson_completed' ||
              e.eventType === 'lesson_failed',
          )
          .map((e) => asObj(e.data).lessonId)
          .filter((x): x is string => typeof x === 'string'),
      ),
    );
    const lessons = lessonIds.length
      ? await this.prisma.lesson.findMany({
          where: { id: { in: lessonIds } },
          select: { id: true, title: true, orderNumber: true },
        })
      : [];
    const lessonById = new Map(lessons.map((l) => [l.id, l]));

    const events = rawEvents.map((e) => {
      const at = e.createdAt.toISOString();
      const d = asObj(e.data);
      if (
        e.eventType === 'lesson_completed' ||
        e.eventType === 'lesson_failed'
      ) {
        const l =
          typeof d.lessonId === 'string'
            ? lessonById.get(d.lessonId)
            : undefined;
        const name = l ? `${l.orderNumber}-dars — ${l.title}` : 'Dars';
        return {
          at,
          type: e.eventType,
          label:
            e.eventType === 'lesson_completed'
              ? `✅ Darsni yakunladi: ${name}`
              : `⚠️ Dars urinishi (yakunlanmadi): ${name}`,
        };
      }
      if (e.eventType === 'streak_updated') {
        const n = typeof d.newStreak === 'number' ? d.newStreak : null;
        return {
          at,
          type: e.eventType,
          label: `🔥 Streak: ${n ?? '—'} kun`,
        };
      }
      // attendance_marked
      const present = d.isPresent === true;
      const late = d.isLate === true;
      const txt = present ? (late ? 'kech keldi' : 'keldi') : 'kelmadi';
      return { at, type: e.eventType, label: `🪑 Davomat: ${txt}` };
    });

    const vstat = (
      t: 'morning' | 'evening',
    ): 'submitted' | 'late' | 'missed' | 'none' => {
      const row = videos.find((v) => v.type === t);
      if (!row) return 'none';
      if (row.status === 'submitted') return 'submitted';
      if (row.status === 'late') return 'late';
      return 'missed';
    };

    const duelList = duels.map((dl) => {
      const isChallenger = dl.challengerId === studentId;
      const opponent = isChallenger
        ? (dl.challenged?.name ?? 'Raqib')
        : (dl.challenger?.name ?? 'Raqib');
      const myScore = isChallenger
        ? dl.challengerScore
        : dl.challengedScore;
      const oppScore = isChallenger
        ? dl.challengedScore
        : dl.challengerScore;
      const result: 'win' | 'loss' | 'draw' = !dl.winnerId
        ? 'draw'
        : dl.winnerId === studentId
          ? 'win'
          : 'loss';
      return {
        at: dl.createdAt.toISOString(),
        opponent,
        result,
        score: `${myScore}:${oppScore}`,
      };
    });

    return {
      date: dateStr,
      summary: {
        studyMinutes: Math.floor((studyRow?.seconds ?? 0) / 60),
        morningVideo: vstat('morning'),
        eveningVideo: vstat('evening'),
      },
      events,
      duels: duelList,
    };
  }

  /**
   * Resolve the student set + branch threshold for a staff requester.
   * mentor → own group; filadmin/manager → own branch. Returns null for
   * roles/states that have no scoped list (e.g. superadmin uses analytics).
   */
  private async resolveScope(user: {
    userId: string;
    role: string;
    tenantId: string;
    branchId?: string | null;
  }): Promise<{
    studentWhere: {
      role: 'student';
      tenantId: string;
      branchId?: string;
      groupId?: string;
    };
    thresholdMinutes: number;
  } | null> {
    if (user.role === 'mentor') {
      const mentor = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { groupId: true, branchId: true },
      });
      if (!mentor?.groupId) return null;
      const branch = mentor.branchId
        ? await this.prisma.branch.findUnique({
            where: { id: mentor.branchId },
            select: { minDailyStudyMinutes: true },
          })
        : null;
      return {
        studentWhere: {
          role: 'student',
          tenantId: user.tenantId,
          groupId: mentor.groupId,
        },
        thresholdMinutes: branch?.minDailyStudyMinutes ?? 0,
      };
    }
    if (user.role === 'filadmin' || user.role === 'manager') {
      if (!user.branchId) return null;
      const branch = await this.prisma.branch.findFirst({
        where: { id: user.branchId, tenantId: user.tenantId },
        select: { minDailyStudyMinutes: true },
      });
      return {
        studentWhere: {
          role: 'student',
          tenantId: user.tenantId,
          branchId: user.branchId,
        },
        thresholdMinutes: branch?.minDailyStudyMinutes ?? 0,
      };
    }
    return null;
  }

  /**
   * Role-aware "today" list. mentor → group, filadmin/manager → branch.
   * Same shape as branchToday so the web can share one component.
   */
  async scopeToday(user: {
    userId: string;
    role: string;
    tenantId: string;
    branchId?: string | null;
  }): Promise<{
    date: string;
    thresholdMinutes: number;
    belowCount: number;
    students: {
      id: string;
      name: string;
      login: string;
      minutes: number;
      below: boolean;
    }[];
  }> {
    const today = tashkentDateString();
    const dateObj = dateStringToDate(today);
    const scope = await this.resolveScope(user);
    if (!scope) {
      return { date: today, thresholdMinutes: 0, belowCount: 0, students: [] };
    }
    const students = await this.prisma.user.findMany({
      where: scope.studentWhere,
      select: { id: true, name: true, login: true },
      orderBy: { name: 'asc' },
    });
    const ids = students.map((s) => s.id);
    const rows = ids.length
      ? await this.prisma.studyTimeDaily.findMany({
          where: { date: dateObj, studentId: { in: ids } },
          select: { studentId: true, seconds: true },
        })
      : [];
    const byId = new Map<string, number>();
    for (const r of rows) byId.set(r.studentId, r.seconds);

    let belowCount = 0;
    const list = students.map((s) => {
      const minutes = Math.floor((byId.get(s.id) ?? 0) / 60);
      const below =
        scope.thresholdMinutes > 0 && minutes < scope.thresholdMinutes;
      if (below) belowCount++;
      return { id: s.id, name: s.name, login: s.login, minutes, below };
    });
    return {
      date: today,
      thresholdMinutes: scope.thresholdMinutes,
      belowCount,
      students: list,
    };
  }

  /**
   * Role-aware total study time over an inclusive Tashkent date range
   * (max 92 days). Per student: total minutes (→ hours), days active,
   * days below the branch threshold.
   */
  async scopeRange(
    user: {
      userId: string;
      role: string;
      tenantId: string;
      branchId?: string | null;
    },
    fromParam?: string,
    toParam?: string,
  ): Promise<{
    from: string;
    to: string;
    thresholdMinutes: number;
    students: {
      id: string;
      name: string;
      login: string;
      totalMinutes: number;
      daysActive: number;
      belowDays: number;
    }[];
  }> {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    let from = re.test(fromParam ?? '')
      ? (fromParam as string)
      : tashkentDateString(new Date(Date.now() - 6 * 86400000));
    let to = re.test(toParam ?? '')
      ? (toParam as string)
      : tashkentDateString();
    if (from > to) [from, to] = [to, from];

    const fromObj = dateStringToDate(from);
    let toObj = dateStringToDate(to);
    const maxMs = 92 * 86400000;
    if (toObj.getTime() - fromObj.getTime() > maxMs) {
      to = tashkentDateString(new Date(fromObj.getTime() + maxMs));
      toObj = dateStringToDate(to);
    }

    const scope = await this.resolveScope(user);
    if (!scope) return { from, to, thresholdMinutes: 0, students: [] };

    const students = await this.prisma.user.findMany({
      where: scope.studentWhere,
      select: { id: true, name: true, login: true },
      orderBy: { name: 'asc' },
    });
    const ids = students.map((s) => s.id);
    const rows = ids.length
      ? await this.prisma.studyTimeDaily.findMany({
          where: {
            studentId: { in: ids },
            date: { gte: fromObj, lte: toObj },
          },
          select: { studentId: true, seconds: true },
        })
      : [];

    const th = scope.thresholdMinutes;
    const agg = new Map<
      string,
      { total: number; daysActive: number; belowDays: number }
    >();
    for (const r of rows) {
      const a = agg.get(r.studentId) ?? {
        total: 0,
        daysActive: 0,
        belowDays: 0,
      };
      const mins = Math.floor(r.seconds / 60);
      a.total += mins;
      if (r.seconds > 0) a.daysActive++;
      if (th > 0 && mins < th) a.belowDays++;
      agg.set(r.studentId, a);
    }

    return {
      from,
      to,
      thresholdMinutes: th,
      students: students.map((s) => {
        const a = agg.get(s.id) ?? {
          total: 0,
          daysActive: 0,
          belowDays: 0,
        };
        return {
          id: s.id,
          name: s.name,
          login: s.login,
          totalMinutes: a.total,
          daysActive: a.daysActive,
          belowDays: a.belowDays,
        };
      }),
    };
  }
}
