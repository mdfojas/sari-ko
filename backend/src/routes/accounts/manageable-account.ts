import { findAccountById, type Account } from '../../queries/accounts/index.js';
import type { Role } from '../../shared/auth/jwt.js';
import { canManageAccountOfRole } from './validation.js';

export type ManageableAccountResult = { ok: true; account: Account } | { ok: false; status: 404 | 403 };

export async function resolveManageableAccount(id: number, callerRole: Role): Promise<ManageableAccountResult> {
  const account = await findAccountById(id);
  if (!account) {
    return { ok: false, status: 404 };
  }
  if (!canManageAccountOfRole(callerRole, account.role)) {
    return { ok: false, status: 403 };
  }
  return { ok: true, account };
}
