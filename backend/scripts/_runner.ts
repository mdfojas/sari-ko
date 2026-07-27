import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

export type ScriptEnv = 'local' | 'production';

export interface ScriptArgs {
  env: ScriptEnv;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// Requires an explicit --env flag and loads that environment's own .env file,
// clearing any already-set DATABASE_URL first so a script can never silently
// inherit the wrong database from ambient shell/process state.
export function parseScriptArgs(argv: string[] = process.argv.slice(2)): ScriptArgs {
  const envArg = argv.find((arg) => arg.startsWith('--env='))?.split('=')[1];

  if (envArg !== 'local' && envArg !== 'production') {
    fail('--env=local or --env=production is required (no default).');
  }

  const envFile = path.resolve(process.cwd(), envArg === 'local' ? '.env' : '.env.production');

  if (!fs.existsSync(envFile)) {
    fail(`Expected env file not found: ${envFile}`);
  }

  delete process.env.DATABASE_URL;
  loadEnv({ path: envFile });

  if (!process.env.DATABASE_URL) {
    fail(`DATABASE_URL was not set by ${envFile}`);
  }

  return { env: envArg, dryRun: argv.includes('--dry-run') };
}

export function createPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}
