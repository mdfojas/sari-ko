import { Pool } from 'pg';

// Tests run against the local Docker Postgres with migrations already applied.
// Feature test suites call this between tests to truncate all data tables
// (everything except node-pg-migrate's own bookkeeping table) rather than
// re-running migrations, which would be far slower.
//
// Uses its own admin connection (the superuser role migrations run as),
// not the app's restricted pool from src/shared/db.ts — that role can only
// INSERT into audit_log, but test cleanup needs to truncate it too.
const adminPool = new Pool({ connectionString: process.env.SUPERUSER_MIGRATIONS_DATABASE_URL });

export async function resetDatabase(): Promise<void> {
  const { rows } = await adminPool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'`,
  );

  if (rows.length === 0) return;

  const tableList = rows.map((row) => `"${row.tablename}"`).join(', ');
  await adminPool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}
