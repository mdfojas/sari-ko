import type { Pool } from 'pg';

// Tests run against the local Docker Postgres with migrations already applied.
// Feature test suites call this between tests to truncate all data tables
// (everything except node-pg-migrate's own bookkeeping table) rather than
// re-running migrations, which would be far slower.
export async function resetDatabase(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'pgmigrations'`,
  );

  if (rows.length === 0) return;

  const tableList = rows.map((row) => `"${row.tablename}"`).join(', ');
  await pool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}
