import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptString, loadKey } from '../common/crypto/vector-cipher';

interface EmbeddingRow {
  user_id: string;
  name: string;
  embedding: string;
  work_start_time: string;
  late_grace_minutes: number;
}

export interface BranchCachePackage {
  branch_id: string;
  tenant_id: string;
  generated_at: string;
  work_start_time: string;
  late_grace_minutes: number;
  embeddings: {
    user_id: string;
    name: string;
    embedding: number[];
  }[];
}

export interface EncryptedBranchCachePackage {
  branch_id: string;
  tenant_id: string;
  generated_at: string;
  work_start_time: string;
  late_grace_minutes: number;
  encrypted: string; // AES-256-GCM ciphertext (base64) of JSON-serialized embeddings
  encryption: 'aes-256-gcm';
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  constructor(private prisma: PrismaService) {}

  async generateBranchCache(
    branchId: string,
    tenantId: string,
  ): Promise<BranchCachePackage> {
    const rows = await this.prisma.$queryRaw<EmbeddingRow[]>`
      SELECT
        u.id AS user_id,
        u.name,
        fe.embedding::text AS embedding,
        b.work_start_time,
        b.late_grace_minutes
      FROM face_embeddings fe
      JOIN users u ON fe.user_id = u.id
      JOIN branches b ON b.id = ${branchId}
      WHERE fe.tenant_id = ${tenantId}
        AND u.branch_id = ${branchId}
        AND fe.is_active = true
        AND u.status = 'active'
    `;

    if (rows.length === 0) {
      return {
        branch_id: branchId,
        tenant_id: tenantId,
        generated_at: new Date().toISOString(),
        work_start_time: '09:00',
        late_grace_minutes: 5,
        embeddings: [],
      };
    }

    const { work_start_time, late_grace_minutes } = rows[0];

    return {
      branch_id: branchId,
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      work_start_time,
      late_grace_minutes,
      embeddings: rows.map((r) => ({
        user_id: r.user_id,
        name: r.name,
        embedding: r.embedding
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((v) => Number(v.trim())),
      })),
    };
  }

  /**
   * Phase 18.9 — encrypted cache variant.
   *
   * Returns the cache with the embeddings list AES-256-GCM encrypted as a
   * single base64 ciphertext blob, suitable for transit to a kiosk that
   * holds the FACE_VECTOR_KEY. Plaintext metadata (branch id, work start,
   * grace minutes) is left in the clear so the kiosk can render its UI
   * before decryption succeeds.
   *
   * If FACE_VECTOR_KEY is unset (dev mode), this method falls back to
   * generateBranchCache() and logs a warning. Production deploys must set
   * the key — encryption-at-rest in PG plus TLS in transit gives adequate
   * security for the cache contents already; encryption here is a
   * defense-in-depth measure for kiosks running on shared networks.
   */
  async generateEncryptedBranchCache(
    branchId: string,
    tenantId: string,
  ): Promise<EncryptedBranchCachePackage | BranchCachePackage> {
    const cache = await this.generateBranchCache(branchId, tenantId);
    let key: Buffer;
    try {
      key = loadKey();
    } catch (err) {
      this.logger.warn(
        `FACE_VECTOR_KEY not configured — returning plaintext cache: ${(err as Error).message}`,
      );
      return cache;
    }
    const json = JSON.stringify(cache.embeddings);
    const encrypted = encryptString(json, key);
    return {
      branch_id: cache.branch_id,
      tenant_id: cache.tenant_id,
      generated_at: cache.generated_at,
      work_start_time: cache.work_start_time,
      late_grace_minutes: cache.late_grace_minutes,
      encrypted,
      encryption: 'aes-256-gcm',
    };
  }
}
