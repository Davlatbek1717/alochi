import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaceEmbedding, FaceRecognitionLog } from '@prisma/client';
import { encryptVector, loadKey } from '../common/crypto/vector-cipher';

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);

  constructor(private prisma: PrismaService) {}

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
