import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class CacheService {
  constructor(private prisma: PrismaService) {}

  async generateBranchCache(branchId: string, tenantId: string): Promise<BranchCachePackage> {
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
}
