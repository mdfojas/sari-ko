# SariKo

**SariKo** ("Sari Sari Store ko") is a personalized inventory and debt-tracking web app for small Philippine sari-sari stores that resell goods bought from groceries.

## Status

The backend API (products, store prices, stores, loans and payments, accounts and authentication) and the Next.js dashboard are implemented. Nothing is deployed yet; it runs locally.

## What it does

Three roles, each with its own view:

- **Admin and store owner** manage the store from the dashboard:
  - **Products**: search by name, alias or barcode (including scanning a barcode with the camera), add, edit and delete.
  - **Store prices**: compare what each store charges for a product, choose which price sets the sale price, and filter the product list by store.
  - **Stores**: add a store before it has any prices, rename it everywhere at once, merge a misspelled store into the right one, or delete a store you no longer use. A product can have at most one price per store.
  - **Loans (utang)**: people with their balances, a ledger of loans and payments with a running balance, line items (from the catalog or freeform), a change history for each loan, and recording or deleting payments.
  - **Accounts**: create, reset and delete accounts, following who may manage whom.
- **Customers** sign in to a read-only view of their own ledger, balance and loan history, plus a price list. They can never see another person's data.
- **Everyone** can change their own username and password from **My Profile**.

Money is stored as whole centavos in 32-bit integers, so the largest single amount is ₱21,474,836.47. Every API route requires a signed-in account unless it is explicitly public (health check and login).

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
3. Create the first admin account (a one-shot that refuses to run once any account exists): `cd backend && npx tsx scripts/create-admin.ts --env=local --username=admin --password=<8-16 characters>`
4. Frontend: copy `frontend/.env.example` to `frontend/.env.local`
5. From the repo root: `npm install && npm run dev` — starts both the backend (`:8080`) and frontend (`:3000`) together. The frontend's dev server proxies `/api/*` to the backend, so there's no CORS setup needed locally.

Or run them separately in two terminals if you prefer: `cd backend && npm run dev` / `cd frontend && npm run dev`.

Store and customer accounts other than the first admin are created from the dashboard (**Accounts**).

## Tests

- Frontend: `cd frontend && npm test` (also `npm run lint` and `npx tsc --noEmit`). These need no database.
- Backend: `cd backend && npm test`.

**The backend tests share one database and empty it between tests.** Point `DATABASE_URL` and `SUPERUSER_MIGRATIONS_DATABASE_URL` at a throwaway database (for example a second Postgres container on another port, migrated with `npm run migrate:up`), not at the one holding data you care about. Both variables can be set in the environment instead of in `backend/.env`; `dotenv` does not override variables that are already set. The suite also includes tests that run the real migrations against awkward old data in a rolled-back scratch schema.

## Migrations

`npm run migrate:up` / `npm run migrate:down` in `backend/`. Every migration is reversible. Two of them change existing data and are worth reading before running them on a database with real data: the stores migration turns each distinct store name into a store (names are trimmed, cut to 100 characters and collapsed ignoring case), and the next one removes any duplicate prices a product has at one store, keeping the selected price (otherwise the most recently updated) and recording what it removed in `store_prices_removed_duplicates`.

See `backend/scripts/README.md` for the backfill/bulk script convention.
