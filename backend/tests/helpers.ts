import { buildApp } from '../src/app.js';
import { pool } from '../src/shared/db.js';
import { signToken, type Role } from '../src/shared/auth/jwt.js';

export const app = buildApp();

export async function createProduct(payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/products', payload });
  return response.json();
}

export async function createPerson(name = 'Test Person') {
  const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ($1) RETURNING id`, [name]);
  return rows[0].id;
}

// Inserts directly via SQL rather than through POST /accounts, so tests for
// other endpoints don't depend on account creation also being correct.
// `passwordHash` defaults to a literal placeholder — pass a real bcrypt hash
// (via hashPassword) only when a test actually needs to verify a password.
export async function createAccount(options: {
  username: string;
  role: Role;
  personId?: number | null;
  passwordHash?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO accounts (username, password_hash, role, person_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [options.username, options.passwordHash ?? 'hash', options.role, options.personId ?? null],
  );
  return rows[0].id;
}

// Auth guards only verify the JWT's signature/payload, never look the
// account up in the DB — so a valid token doesn't require a real accounts
// row to exist for tests that only care about role-gating.
export function authHeaderFor(
  role: Role,
  options: { accountId?: number; personId?: number | null; username?: string } = {},
) {
  const token = signToken({
    accountId: options.accountId ?? 1,
    username: options.username ?? `${role}-test`,
    role,
    personId: options.personId ?? null,
  });
  return { authorization: `Bearer ${token}` };
}
