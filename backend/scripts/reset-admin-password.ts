import type { Pool } from 'pg';
import { hashPassword } from '../src/shared/auth/password.js';
import { createPool, parseScriptArgs } from './_runner.js';

// Recovery path for the "only one admin exists and they forgot their
// password" lockout — the API can't help here, since resetting a password
// requires being authenticated as someone with permission over that account,
// and by definition nobody like that can log in in this scenario. Unlike
// create-admin.ts, this has no empty-table lock: recovery is a legitimate
// recurring need, not a one-shot bootstrap.
export async function resetAdminPassword(
  pool: Pool,
  username: string,
  newPassword: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const { rows } = await pool.query(`SELECT id FROM accounts WHERE username = $1 AND role = 'admin'`, [username]);
  if (rows.length === 0) {
    throw new Error(`No admin account found with username '${username}'.`);
  }

  if (options.dryRun) {
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(`UPDATE accounts SET password_hash = $1, updated_at = now() WHERE id = $2`, [
    passwordHash,
    rows[0].id,
  ]);
}

function parseCredentialArgs(argv: string[]): { username: string; password: string } {
  const username = argv.find((arg) => arg.startsWith('--username='))?.split('=')[1];
  const password = argv.find((arg) => arg.startsWith('--password='))?.split('=')[1];

  if (!username || !password) {
    console.error('Error: --username=<name> and --password=<newPassword> are required.');
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
    await resetAdminPassword(pool, username, password, { dryRun });
    console.log(`${prefix} ${dryRun ? 'Would reset' : 'Reset'} password for admin account '${username}'.`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
