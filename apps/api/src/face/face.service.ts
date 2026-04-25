import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaceEmbedding, FaceRecognitionLog } from '@prisma/client';

@Injectable()
export class FaceService {
  constructor(private prisma: PrismaService) {}

  async enroll(userId: string, tenantId: string, enrolledVia: string): Promise<FaceEmbedding> {
    return this.prisma.faceEmbedding.create({
      data: { userId, tenantId, enrolledVia },
    });
  }

  async getEnrollments(userId: string): Promise<FaceEmbedding[]> {
    return this.prisma.faceEmbedding.findMany({
      where: { userId, isActive: true },
    });
  }

  async deactivate(userId: string): Promise<void> {
    await this.prisma.faceEmbedding.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async logRecognition(data: {
    tenantId: string;
    branchId: string;
    deviceId: string;
    matchedUserId?: string;
    confidence?: number;
    method: string;
    result: string;
    livenessPassd?: boolean;
  }): Promise<FaceRecognitionLog> {
    return this.prisma.faceRecognitionLog.create({ data });
  }

  async getBranchLogs(branchId: string): Promise<FaceRecognitionLog[]> {
    return this.prisma.faceRecognitionLog.findMany({
      where: { branchId },
      orderBy: { attemptedAt: 'desc' },
      take: 50,
    });
  }
}
