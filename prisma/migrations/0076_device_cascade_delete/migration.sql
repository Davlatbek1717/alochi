-- #7 — Add ON DELETE CASCADE to every Device child relation.
-- Previously these FKs used the default NO ACTION, so deleting a Device failed
-- on a constraint violation while it still had enrollments/events/commands/
-- health pings/screenshots. Cascading lets a device (and only its own data) be
-- removed cleanly.
--
-- Idempotent: for each child table we drop whatever FK currently sits on
-- "deviceId" (whatever Postgres auto-named it) and re-add the canonical
-- Prisma-named constraint with CASCADE. Safe to re-run.

DO $$
DECLARE
  t      text;
  cn     text;
  tables text[] := ARRAY[
    'DeviceEnrollment',
    'DeviceEvent',
    'DeviceCommand',
    'DeviceHealthPing',
    'ScreenCapture'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR cn IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel       ON rel.oid = con.conrelid
      JOIN pg_namespace ns    ON ns.oid = rel.relnamespace
      JOIN pg_attribute att   ON att.attrelid = con.conrelid
                             AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND ns.nspname = 'public'
        AND rel.relname = t
        AND att.attname = 'deviceId'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, cn);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("deviceId") '
      || 'REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE',
      t, t || '_deviceId_fkey'
    );
  END LOOP;
END $$;
