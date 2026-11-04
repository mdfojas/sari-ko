import type { Account } from './accounts-client';
import type { Role } from './auth-types';

// Mirrors the backend's canManageAccountOfRole (routes/accounts/validation.ts):
// admin manages every role, store_owner manages customers only.
export function canManageAccountOfRole(callerRole: Role, targetRole: Role): boolean {
  if (callerRole === 'admin') return true;
  if (callerRole === 'store_owner') return targetRole === 'customer';
  return false;
}

// The backend refuses (409) to delete the sole remaining admin, since the
// store could otherwise lock itself out of all account management.
export function isLastAdmin(accounts: Account[], account: Account): boolean {
  return account.role === 'admin' && accounts.filter((a) => a.role === 'admin').length <= 1;
}
