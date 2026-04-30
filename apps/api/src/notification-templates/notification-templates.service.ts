import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Default Telegram / in-app notification copy. These are used when no
 * per-tenant override exists in `notification_templates`. Superadmins can
 * customise any of these via the `/superadmin/templates` page.
 *
 * Placeholders use `{varName}` syntax — see {@link NotificationTemplatesService.render}.
 */
export const DEFAULT_TEMPLATES: Record<string, string> = {
  // Delegations (spec §6.1)
  'delegation.created':
    '📤 Sizga vaqtinchalik {role} vakolati berildi.\nKim bergan: {fromUserName}\nSiz bajara olasiz: {permissionsList}\nSabab: {reason}\nMuddati: {endsAt}\n\nQabul qilish uchun: /delegations sahifasiga kiring.',
  'delegation.accepted': '✅ {toUserName} delegatsiyangizni qabul qildi.',
  'delegation.rejected':
    '❌ {toUserName} delegatsiyangizni rad etdi.\nSabab: {rejectionReason}',
  'delegation.cancelled':
    '🚫 Sizga berilgan {role} vakolati bekor qilindi.\nKim bekor qildi: {cancelledBy}',
  'delegation.completed': '⏰ Delegatsiya muddati tugadi.',

  // Warnings (count differentiation)
  'warning.1':
    '⚠️ Sizga ogohlantirish berildi. Sabab: {reason}. Hisob hali bloklanmagan.',
  'warning.2':
    '⚠️ Farzandingiz {studentName} 2-ogohlantirish oldi. Yana 1 ta ogohlantirish profilingizni bloklaydi. Sabab: {reason}',
  'warning.3':
    "🚫 Farzandingiz {studentName} 3-ogohlantirish oldi. Hisob bloklanadi. Bog'laning: filadmin",

  // Auth / payment block (Phase 23.13 — spec text)
  'auth.payment_block':
    "💳 To'lov muddati o'tdi. To'lovni amalga oshirgach, ertasi kuni kirish tiklanaadi.",

  // Status worse / improved (spec §6)
  'status.worse_manager':
    "⚠️ {studentName} holati {oldColor}dan {newColor}ga o'zgardi. Filial: {branchName}",
  'status.worse_parent':
    "⚠️ Farzandingiz {studentName} holati {newColor} bo'ldi. Bilim markaziga bog'laning.",
  'status.improved_parent':
    "🎉 Farzandingiz {studentName} yaxshi natija ko'rsatdi! Holat: {newColor}",

  // Streak milestone
  'streak.milestone30':
    '🎉 Tabriklaymiz! Farzandingiz {studentName} 30 kunlik streak qildi! Davom ettirsin.',

  // Certificates
  'certificate.earned.student': '🏆 Yangi sertifikat oldingiz: {certName}!',
  'certificate.earned.parent':
    '🏆 Farzandingiz {studentName} yangi sertifikat oldi: {certName}',

  // Attendance
  'attendance.absent_2day':
    '⚠️ Farzandingiz {studentName} 2 kundir darsga kelmagan.',

  // Face / device monitoring
  'face.cache_stale':
    '⚠️ Filial {branchName} yuz tanish keshi {staleDays} kun yangilanmagan. Internet aloqasini tekshiring.',
  'face.enrollment_reminder':
    "⚠️ Filial {branchName} hali ba'zi xodimlar yuzini ro'yxatdan o'tkazmagan: {namesList}. Iltimos, ro'yxatdan o'tkazing.",
  'face.recognition_failed_3x':
    '⚠️ Filial {branchName} planshetida 3 marta yuz tanish muvaffaqiyatsiz.',

  // Spaced repetition (§15.4)
  'spaced_repetition.morning':
    '📚 Bugun {count} ta dars takrorlash uchun. Birinchisi: "{firstLessonTitle}". Davom etish uchun ilovaga kiring.',

  // Tasks (§9 task_due_reminder)
  'task.due_tomorrow':
    '⏰ Vazifa muddati ertaga: "{title}". Iltimos, bugun yakunlang.',

  // Payment unblock monitoring (§15.3)
  'unblock.failed_monitoring':
    "🚨 {count} ta o'quvchining unblock_at vaqti o'tdi, ammo ular hali bloklanganlikda qolmoqda: {userIds}. Tekshirib ko'ring.",
};

@Injectable()
export class NotificationTemplatesService {
  private readonly logger = new Logger(NotificationTemplatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Render a template by key, substituting `{varName}` placeholders from
   * `vars`. Resolution order:
   *   1. Per-tenant override in `notification_templates` (if `tenantId` given).
   *   2. Hardcoded default in {@link DEFAULT_TEMPLATES}.
   *   3. The key itself, with a logged warning, so production never throws.
   */
  async render(
    key: string,
    vars: Record<string, string | number | undefined> = {},
    tenantId?: string,
  ): Promise<string> {
    let body: string | null = null;

    if (tenantId) {
      try {
        const tpl = await this.prisma.notificationTemplate.findUnique({
          where: { tenantId_key: { tenantId, key } },
        });
        body = tpl?.body ?? null;
      } catch (err) {
        this.logger.warn(`Template lookup failed for ${key}: ${err}`);
      }
    }

    if (!body) {
      body = DEFAULT_TEMPLATES[key] ?? null;
    }

    if (!body) {
      this.logger.warn(
        `Notification template "${key}" topilmadi — fallback ishlatildi. Iltimos, /superadmin/templates orqali yarating.`,
      );
      body = key;
    }

    return this.interpolate(body, vars);
  }

  /**
   * Synchronous interpolation only — used internally and exposed for tests.
   */
  interpolate(
    body: string,
    vars: Record<string, string | number | undefined>,
  ): string {
    return body.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = vars[name];
      return v === undefined || v === null ? `{${name}}` : String(v);
    });
  }

  async listForTenant(
    tenantId: string,
  ): Promise<Array<{ key: string; body: string; isDefault: boolean }>> {
    const overrides = await this.prisma.notificationTemplate.findMany({
      where: { tenantId },
    });
    const overrideMap = new Map(overrides.map((o) => [o.key, o.body]));

    const allKeys = new Set([
      ...Object.keys(DEFAULT_TEMPLATES),
      ...overrideMap.keys(),
    ]);

    return Array.from(allKeys)
      .sort()
      .map((key) => ({
        key,
        body: overrideMap.get(key) ?? DEFAULT_TEMPLATES[key] ?? '',
        isDefault: !overrideMap.has(key),
      }));
  }

  async upsert(tenantId: string, key: string, body: string) {
    return this.prisma.notificationTemplate.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, body },
      update: { body },
    });
  }

  async resetToDefault(tenantId: string, key: string) {
    await this.prisma.notificationTemplate
      .delete({ where: { tenantId_key: { tenantId, key } } })
      .catch(() => undefined);
  }

  /**
   * Used by tests / sync code paths that already know the body but want
   * to substitute placeholders.
   */
  static interpolateStatic(
    body: string,
    vars: Record<string, string | number | undefined>,
  ): string {
    return body.replace(/\{(\w+)\}/g, (_, name: string) => {
      const v = vars[name];
      return v === undefined || v === null ? `{${name}}` : String(v);
    });
  }
}
