import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class CronFaceService {
  private readonly logger = new Logger(CronFaceService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
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
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const staleDevices = await this.prisma.branchDevice.findMany({
      where: {
        isActive: true,
        OR: [{ lastCacheSync: { lt: twoDaysAgo } }, { lastCacheSync: null }],
      },
      include: { branch: { select: { name: true, filadminId: true } } },
    });

    for (const device of staleDevices) {
      this.logger.warn(`Stale cache: ${device.deviceName} (${device.branch.name})`);
    }
  }

  @Cron('0 9 * * 1', { name: 'face_enrollment_reminder' })
  async sendEnrollmentReminder() {
    this.logger.log('Face ID: enrollment reminder boshlanmoqda...');

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
        (u: { id: string; name: string; faceEmbeddings: { id: string }[] }) => u.faceEmbeddings.length === 0,
      );
      if (unenrolled.length === 0) continue;

      total += unenrolled.length;
      this.logger.warn(
        `Branch ${branch.name}: ${unenrolled.length} ta xodim yuz ro'yxatidan o'tmagan: ` +
          unenrolled.map((u: { name: string }) => u.name).join(', '),
      );
    }

    if (total > 0) {
      this.logger.log(`Enrollment reminder: jami ${total} ta xodim`);
    }
  }
}
