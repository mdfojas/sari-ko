# SariKo

**SariKo** ("Sari Sari Store ko") is a personalized inventory and debt-tracking web app for small Philippine sari-sari stores that resell goods bought from groceries.

## Status

Backend-only phase — building and testing the API thoroughly before any frontend work begins.

## Stack

Node.js + TypeScript, Fastify, raw `pg` (no ORM), `node-pg-migrate`, PostgreSQL (Docker locally, Neon in production), Vitest.

## Structure

```
backend/   # Fastify API — routes, db access, migrations, tests, scripts
frontend/  # not started yet
```

See `backend/scripts/README.md` for the backfill/bulk script convention.
