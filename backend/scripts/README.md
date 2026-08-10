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

## Account bootstrap/recovery scripts

- **`create-admin.ts`** — creates the very first `admin` account, breaking the
  chicken-and-egg problem of needing an admin to create accounts before any
  admin exists (see feature-specs/03-accounts-and-auth.md). This is a
  **permanent one-shot**: it refuses to run at all once the `accounts` table
  has any row in it, with no override flag. Every account after the first —
  including additional admins — goes through the authenticated `POST
  /accounts` API instead.

  ```bash
  npx tsx scripts/create-admin.ts --env=local --username=mark --password=...
  ```

- **`reset-admin-password.ts`** — recovers a locked-out admin (forgotten
  password, only one admin exists, so nobody can call the authenticated
  `PATCH /accounts/:id/password` to help). Unlike `create-admin.ts`, this has
  no one-shot lock — recovery is a legitimate recurring need — but it does
  verify the given `--username` exists and is `role = 'admin'` before writing
  anything.

  ```bash
  npx tsx scripts/reset-admin-password.ts --env=local --username=mark --password=...
  ```

Both accept `--dry-run` like any other script here, and both use
`hashPassword` from `src/shared/auth/password.ts` so their password handling
stays identical to every other path in the app.
