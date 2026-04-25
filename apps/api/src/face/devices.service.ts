import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BranchDevice } from '@prisma/client';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async register(branchId: string, deviceName: string): Promise<BranchDevice> {
    const deviceToken = randomBytes(32).toString('hex');
    return this.prisma.branchDevice.create({
      data: { branchId, deviceName, deviceToken },
    });
  }

  async listForBranch(branchId: string): Promise<BranchDevice[]> {
    return this.prisma.branchDevice.findMany({
      where: { branchId, isActive: true },
    });
  }

  async deactivate(deviceId: string): Promise<void> {
    await this.prisma.branchDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });
  }

  async validateToken(deviceToken: string): Promise<BranchDevice | null> {
    return this.prisma.branchDevice.findUnique({
      where: { deviceToken },
    });
  }
}
