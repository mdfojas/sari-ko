import { buildApp } from '../src/app.js';
import { signToken, type Role } from '../src/shared/auth/jwt.js';

export const app = buildApp();

export async function createProduct(payload: Record<string, unknown>) {
  const response = await app.inject({ method: 'POST', url: '/products', payload });
  return response.json();
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
