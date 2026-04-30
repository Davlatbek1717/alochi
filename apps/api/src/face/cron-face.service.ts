import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class CronFaceService {
  private readonly logger = new Logger(CronFaceService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private telegram: TelegramService,
  ) {}

  @Cron('0 23 * * *', { name: 'face_cache_generate' })
  async generateAllCaches() {
    this.logger.log('Face ID: kesh generatsiya boshlanmoqda...');

    let branches;
    try {
      branches = await this.prisma.branch.findMany({
        include: { users: { where: { status: 'active' } } },
      });
    } catch (err) {
      this.logger.error(`Face cache: branch listini olib bo'lmadi — ${err}`);
      return;
    }

    for (const branch of branches) {
      try {
        await this.cacheService.generateBranchCache(branch.id, branch.tenantId);
        this.logger.log(`Branch ${branch.name}: kesh yangilandi`);
      } catch (err) {
        this.logger.error(`Branch ${branch.name}: kesh xatosi — ${err}`);
      }
    }
  }

  @Cron('0 8 * * *', { name: 'face_cache_stale_alert' })
  async alertStaleCache() {
    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const staleDevices = await this.prisma.branchDevice.findMany({
        where: {
          isActive: true,
          OR: [{ lastCacheSync: { lt: twoDaysAgo } }, { lastCacheSync: null }],
        },
        include: {
          branch: {
            select: { id: true, name: true, tenantId: true, filadminId: true },
          },
        },
      });

      // Group stale devices by branch so each filadmin gets a single alert.
      const byBranch = new Map<
        string,
        {
          branchId: string;
          branchName: string;
          tenantId: string;
          staleDays: number;
        }
      >();
      for (const device of staleDevices) {
        const lastSync = device.lastCacheSync;
        const staleDays = lastSync
          ? Math.floor(
              (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 999;
        const existing = byBranch.get(device.branch.id);
        if (!existing || staleDays > existing.staleDays) {
          byBranch.set(device.branch.id, {
            branchId: device.branch.id,
            branchName: device.branch.name,
            tenantId: device.branch.tenantId,
            staleDays,
          });
        }
      }

      for (const info of byBranch.values()) {
        const filadmins = await this.prisma.user.findMany({
          where: {
            tenantId: info.tenantId,
            branchId: info.branchId,
            role: 'filadmin',
            status: 'active',
          },
          select: { id: true },
        });
        for (const fa of filadmins) {
          await this.telegram
            .sendToUser(
              fa.id,
              'face.cache_stale',
              { branchName: info.branchName, staleDays: info.staleDays },
              info.tenantId,
            )
            .catch((err) =>
              this.logger.warn(
                `Stale cache Telegram failed (${fa.id}): ${err}`,
              ),
            );
        }
      }
    } catch (err) {
      this.logger.error(
        `face_cache_stale_alert failed: ${(err as Error).message}`,
      );
    }
  }

  @Cron('0 9 * * 1', { name: 'face_enrollment_reminder' })
  async sendEnrollmentReminder() {
    this.logger.log('Face ID: enrollment reminder boshlanmoqda...');

    try {
      const branches = await this.prisma.branch.findMany({
        include: {
          users: {
            where: {
              status: 'active',
              role: { in: ['mentor', 'manager', 'filadmin', 'tester'] },
            },
            select: {
              id: true,
              name: true,
              role: true,
              faceEmbeddings: {
                where: { isActive: true },
                select: { id: true },
              },
            },
          },
        },
      });

      let total = 0;
      for (const branch of branches) {
        const unenrolled = branch.users.filter(
          (u) => u.faceEmbeddings.length === 0,
        );
        if (unenrolled.length === 0) continue;

        total += unenrolled.length;

        // Notify the branch's filadmin(s). Skip filadmins themselves so they
        // don't get pinged for their own missing enrollment via this channel.
        const filadmins = await this.prisma.user.findMany({
          where: {
            tenantId: branch.tenantId,
            branchId: branch.id,
            role: 'filadmin',
            status: 'active',
          },
          select: { id: true },
        });

        const namesList = unenrolled.map((u) => u.name).join(', ');
        for (const fa of filadmins) {
          await this.telegram
            .sendToUser(
              fa.id,
              'face.enrollment_reminder',
              { branchName: branch.name, namesList },
              branch.tenantId,
            )
            .catch((err) =>
              this.logger.warn(
                `Enrollment reminder Telegram failed (${fa.id}): ${err}`,
              ),
            );
        }
      }

      if (total > 0) {
        this.logger.log(`Enrollment reminder: jami ${total} ta xodim`);
      }
    } catch (err) {
      this.logger.error(
        `face_enrollment_reminder failed: ${(err as Error).message}`,
      );
    }
  }
}
