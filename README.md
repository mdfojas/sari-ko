# SariKo

**SariKo** ("Sari Sari Store ko") is a personalized inventory and debt-tracking web app for small Philippine sari-sari stores that resell goods bought from groceries.

## Status

Backend (Milestones 0–3) is done. Frontend dashboard (Milestone 4) is in progress.

## Stack

- **Backend**: Node.js + TypeScript, Fastify, raw `pg` (no ORM), `node-pg-migrate`, PostgreSQL (Docker locally, Neon in production), Vitest.
- **Frontend**: Next.js (App Router) + TypeScript, Tailwind, TanStack Query, Vitest + React Testing Library.

## Structure

```
backend/   # Fastify API — routes, db access, migrations, tests, scripts
frontend/  # Next.js dashboard — consumes the backend over HTTPS/JSON, deploys independently
```

## Local development

1. Start Postgres: `docker compose up -d`
2. Backend: copy `backend/.env.example` to `backend/.env`, fill in values, then `cd backend && npm install && npm run migrate:up`
3. Frontend: copy `frontend/.env.example` to `frontend/.env.local`
4. From the repo root: `npm install && npm run dev` — starts both the backend (`:8080`) and frontend (`:3000`) together. The frontend's dev server proxies `/api/*` to the backend, so there's no CORS setup needed locally.

Or run them separately in two terminals if you prefer: `cd backend && npm run dev` / `cd frontend && npm run dev`.

See `backend/scripts/README.md` for the backfill/bulk script convention.
