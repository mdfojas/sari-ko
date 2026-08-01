# Backfill / bulk scripts

One-off scripts live here, run manually from a terminal — never scheduled, never
triggered by the running API server.

## Convention

Every script imports `parseScriptArgs()` from [`_runner.ts`](_runner.ts) and requires:

- `--env=local` or `--env=production` — no default, so a script can never run
  against the wrong database by accident. `local` loads `backend/.env`;
  `production` loads `backend/.env.production` (gitignored, create it locally
  with the Neon production `DATABASE_URL` when you actually need to run a
  script against production).
- `--dry-run` (optional) — logs what the script would change without writing.

## Running a script

```bash
npx tsx scripts/count-rows.ts --env=local
npx tsx scripts/count-rows.ts --env=local --dry-run
npx tsx scripts/count-rows.ts --env=production
```

Running without `--env` fails immediately with a clear error instead of
silently defaulting anywhere.

## Writing a new script

1. Import `parseScriptArgs` and `createPool` from `_runner.ts`.
2. Call `parseScriptArgs()` first, before anything else touches the database.
3. Use `createPool()` for a fresh `pg.Pool` scoped to the resolved
   `DATABASE_URL` — don't reuse the app's shared pool from `src/shared/db.ts`.
4. Write bulk inserts/updates as hand-rolled SQL (multi-row `INSERT ... VALUES
   (...), (...)`, or `UPDATE ... FROM (VALUES ...)`), consistent with the
   project's raw-SQL, no-ORM convention.
5. Respect `dryRun`: log intended changes and skip the actual write when true.
6. Call `pool.end()` when done so the script process exits cleanly.

See [`count-rows.ts`](count-rows.ts) for a trivial working example.
