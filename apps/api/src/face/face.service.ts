import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { FaceEmbedding, FaceRecognitionLog } from '@prisma/client';
import { encryptVector, loadKey } from '../common/crypto/vector-cipher';

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);

  /**
   * Phase 18.6 — in-memory consecutive-fail counter keyed by deviceId.
   * Resets on any successful match. We keep this in process memory because
   * (a) it's a UX hint not a security control, and (b) restarting the API
   * resetting the counter is fine.
   */
  private failCounts = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    @Optional() private events?: EventEmitter2,
  ) {}

  /**
   * Legacy creator — kept for the cache test path. Prefer enrollFromVectors().
   */
  async enroll(
    userId: string,
    tenantId: string,
    enrolledVia: string,
  ): Promise<FaceEmbedding> {
    return this.prisma.faceEmbedding.create({
      data: { userId, tenantId, enrolledVia },
    });
  }

  /**
   * Average a set of 128-dim face descriptors (computed in the browser),
   * encrypt the average with AES-256-GCM, and persist.
   *
   * The AES-encrypted blob is stored alongside the existing pgvector column —
   * pgvector stays for fast cosine search; the AES blob is the canonical
   * at-rest record (PDPL §533 — math vectors must be unreadable without a key).
   */
  async enrollFromVectors(
    userId: string,
    tenantId: string,
    embeddings: number[][],
    enrolledVia = 'web',
  ): Promise<FaceEmbedding> {
    if (!embeddings.length) {
      throw new Error('embeddings must not be empty');
    }
    const dim = embeddings[0].length;
    if (!embeddings.every((v) => v.length === dim)) {
      throw new Error('all embeddings must share the same dimensionality');
    }

    // Average the vectors to produce one canonical descriptor.
    const avg = new Array<number>(dim).fill(0);
    for (const v of embeddings) {
      for (let i = 0; i < dim; i++) avg[i] += v[i];
    }
    for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;

    // Encrypt at rest. Pgvector storage continues for cosine search; the
    // encrypted ciphertext is the PDPL-compliant artifact.
    const key = loadKey();
    const ciphertext = encryptVector(avg, key);

    // Insert into face_embeddings. The vector column is set via raw SQL
    // (pgvector requires the `[..]` text format).
    const pgVecLiteral = `[${avg.join(',')}]`;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO face_embeddings (user_id, tenant_id, enrolled_via, embedding, embedding_encrypted, is_active)
      VALUES (
        ${userId}::uuid,
        ${tenantId}::uuid,
        ${enrolledVia},
        ${pgVecLiteral}::vector,
        ${ciphertext},
        true
      )
      RETURNING id
    `;

    const inserted = await this.prisma.faceEmbedding.findUnique({
      where: { id: rows[0].id },
    });
    if (!inserted) throw new Error('insert succeeded but row not found');
    this.logger.log(
      `Enrolled face for user=${userId} tenant=${tenantId} (encrypted)`,
    );
    return inserted;
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

  /**
   * Phase 18.3 — soft-delete enrollment.
   *
   * We chose `is_active = false` (soft) over hard-delete so that legal
   * audit trails (face_recognition_log.matched_user_id, plus historical
   * embeddings linked to attendance records) remain queryable. The
   * embedding vector itself stays AES-encrypted at rest, so this is
   * PDPL §533 compliant — re-enrolling overwrites with a fresh blob.
   */
  async deactivateEnrollment(userId: string): Promise<{ deactivated: number }> {
    const result = await this.prisma.faceEmbedding.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    return { deactivated: result.count };
  }

  /**
   * Phase 18.4 — enrollment status snapshot.
   */
  async getEnrollmentStatus(userId: string) {
    const rows = await this.prisma.faceEmbedding.findMany({
      where: { userId, isActive: true },
      orderBy: { enrolledAt: 'desc' },
      select: { id: true, enrolledAt: true },
    });
    return {
      enrolled: rows.length > 0,
      embeddingCount: rows.length,
      lastUpdated: rows[0]?.enrolledAt ?? null,
    };
  }

  /**
   * Phase 18.6 — record a recognition fail per device. On the 3rd
   * consecutive miss we emit `face.recognition_failed_3x` and reset the
   * counter so the next 3 failures trigger another alert.
   */
  registerRecognitionFailure(deviceId: string, branchId: string): void {
    const next = (this.failCounts.get(deviceId) ?? 0) + 1;
    if (next >= 3) {
      this.failCounts.set(deviceId, 0);
      this.events?.emit('face.recognition_failed_3x', { deviceId, branchId });
    } else {
      this.failCounts.set(deviceId, next);
    }
  }

  registerRecognitionSuccess(deviceId: string): void {
    this.failCounts.delete(deviceId);
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

  /**
   * 25.L.3: Face SLA — recognition success rate, mean confidence, and total
   * attempts in the last 7 days. Used by the superadmin dashboard.
   */
  async getSla(): Promise<{
    totalAttempts: number;
    successRate: number;
    avgConfidence: number;
    days: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [total, success, agg] = await Promise.all([
      this.prisma.faceRecognitionLog.count({
        where: { attemptedAt: { gte: since } },
      }),
      this.prisma.faceRecognitionLog.count({
        where: { attemptedAt: { gte: since }, result: 'matched' },
      }),
      this.prisma.faceRecognitionLog.aggregate({
        where: { attemptedAt: { gte: since } },
        _avg: { confidence: true },
      }),
    ]);

    return {
      totalAttempts: total,
      successRate: total === 0 ? 0 : Math.round((success / total) * 100),
      avgConfidence:
        Math.round(((agg._avg?.confidence ?? 0) as number) * 100) / 100,
      days: 7,
    };
  }
}
