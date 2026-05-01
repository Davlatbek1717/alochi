# Postgres Read Replicas

**Status:** Documentation stub for Phase 25.N.2.

A'lochi runs a single Postgres primary today. As tenant load grows we want to
offload heavy read traffic (analytics dashboards, churn ML reads, ClickHouse
backfill scans, audit-log queries) to a read replica without affecting the
write path.

## Topology

```
┌─────────┐   stream replication   ┌──────────┐
│ primary │ ─────────────────────▶ │ replica1 │   <-- analytics, audit reads
└─────────┘                        └──────────┘
   ▲ writes
   │
 NestJS API ── PrismaService (writes/strong reads)
            └─ PrismaReplicaService (eventual-consistency reads)
```

We deliberately keep replication logical (or streaming, depending on cloud
provider) and accept ~1 second lag. Pages that need read-after-write semantics
(e.g., immediately reading back a `KpiScore` you just inserted) MUST use the
primary `PrismaService`.

## Wiring

`apps/api/src/prisma/prisma-replica.service.ts` is a thin wrapper that points
to `process.env.DATABASE_REPLICA_URL`. When the env var is missing it transparently
falls back to the primary, so dev/CI keeps working with a single DB.

```ts
// good — eventual consistency is fine for analytics aggregations
const rows = await this.replica.studentProgress.findMany({
  where: { studentId },
});

// bad — caller wrote 10ms ago, replica may not have it yet
const newRecord = await this.prisma.payment.create({ data });
const verify = await this.replica.payment.findUnique({ where: { id: newRecord.id } });
```

## Operational notes

- Set `DATABASE_REPLICA_URL=postgres://...` in production.
- Monitor `pg_stat_replication.replay_lag`; alert at >5s.
- When promoting a replica during a primary failure, swap the URLs and restart
  the API: PrismaClient does **not** auto-reconnect to a new endpoint.
- Replicas are read-only: any service that calls write methods on the replica
  client will get a `read-only transaction` error, which is fine — caller
  should be using the primary `PrismaService`.

## Future work

- Connection pooling (PgBouncer / RDS Proxy) in front of both endpoints.
- Per-tenant sharding once we exceed ~1M students globally.
- Replica health-checks via `/health/db-replica` endpoint.
