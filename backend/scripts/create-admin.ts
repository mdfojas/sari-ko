import type { Pool } from 'pg';
import { hashPassword } from '../src/shared/auth/password.js';
import { createPool, parseScriptArgs } from './_runner.js';

// create-admin.ts is a permanent one-shot: it only ever creates the very
// first admin account, to break the chicken-and-egg problem of needing an
// admin to create accounts before any admin exists. Once one account of any
// role exists, every future account (including additional admins) goes
// through the authenticated POST /accounts API instead — this script never
// runs again, by design, with no override flag.
export async function createFirstAdmin(
  pool: Pool,
  username: string,
  password: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const { rows } = await pool.query(`SELECT 1 FROM accounts LIMIT 1`);
  if (rows.length > 0) {
    throw new Error(
      'Refusing to run: the accounts table already has at least one row. ' +
        'create-admin.ts only ever creates the very first admin — use POST /accounts instead.',
    );
  }

  if (options.dryRun) {
    return;
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO accounts (username, password_hash, role, person_id) VALUES ($1, $2, 'admin', NULL)`,
    [username, passwordHash],
  );
}

function parseCredentialArgs(argv: string[]): { username: string; password: string } {
  const username = argv.find((arg) => arg.startsWith('--username='))?.split('=')[1];
  const password = argv.find((arg) => arg.startsWith('--password='))?.split('=')[1];

  if (!username || !password) {
    console.error('Error: --username=<name> and --password=<password> are required.');
    process.exit(1);
  }

  return { username, password };
}

async function main() {
  const { env, dryRun } = parseScriptArgs();
  const { username, password } = parseCredentialArgs(process.argv.slice(2));
  const pool = createPool();
  const prefix = dryRun ? `[dry-run] [${env}]` : `[${env}]`;

  try {
    await createFirstAdmin(pool, username, password, { dryRun });
    console.log(`${prefix} ${dryRun ? 'Would create' : 'Created'} admin account '${username}'.`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Only run when executed directly (`npx tsx scripts/create-admin.ts`), not
// when imported by tests for `createFirstAdmin`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
