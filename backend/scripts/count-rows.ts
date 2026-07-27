import { createPool, parseScriptArgs } from './_runner.js';

const TABLE = 'pgmigrations';

async function main() {
  const { env, dryRun } = parseScriptArgs();
  const pool = createPool();

  const { rows } = await pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM "${TABLE}"`);
  const count = rows[0].count;

  const prefix = dryRun ? `[dry-run] [${env}]` : `[${env}]`;
  console.log(`${prefix} "${TABLE}" has ${count} row(s).`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
