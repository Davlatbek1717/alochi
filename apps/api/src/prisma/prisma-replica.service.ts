import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * 25.N.2: Read-replica Prisma client (stub).
 *
 * - When `DATABASE_REPLICA_URL` is set, opens a separate connection to the
 *   replica with `datasourceUrl` override.
 * - When it isn't set, transparently delegates to the primary `PrismaService`,
 *   so dev/CI environments keep working with a single database.
 *
 * Use for read-only queries that tolerate ~1s replication lag (analytics
 * dashboards, churn batch reads, audit scans). For read-after-write queries,
 * stick with the primary `PrismaService`.
 *
 * NOTE: This is intentionally not wired into a global Module yet — pages that
 * need it should import it explicitly so the migration is incremental.
 */
@Injectable()
export class PrismaReplicaService extends PrismaClient implements OnModuleInit {
  private hasReplica: boolean;

  constructor(private primary: PrismaService) {
    const replicaUrl = process.env.DATABASE_REPLICA_URL;
    super(replicaUrl ? { datasourceUrl: replicaUrl } : undefined);
    this.hasReplica = !!replicaUrl;
  }

  async onModuleInit() {
    if (this.hasReplica) {
      await this.$connect();
    }
  }

  /**
   * Convenience method that always returns a read-capable client. Falls
   * back to the primary when no replica is configured.
   */
  get reader(): PrismaClient {
    return this.hasReplica
      ? (this as PrismaClient)
      : (this.primary as unknown as PrismaClient);
  }
}
