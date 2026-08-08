import { validatePasswordStrength } from '../../shared/auth/password.js';
import type { Role } from '../../shared/auth/jwt.js';

const VALID_ROLES: Role[] = ['admin', 'store_owner', 'customer'];

export interface CreateAccountBody {
  username?: string;
  password?: string;
  role?: string;
  person_id?: number;
}

export function validateCreateAccount(body: CreateAccountBody): string | null {
  if (!body.role || !VALID_ROLES.includes(body.role as Role)) {
    return 'role must be one of admin, store_owner, customer';
  }

  if (body.role === 'customer' && !body.person_id) {
    return 'person_id is required for a customer account';
  }

  if (body.role !== 'customer' && body.person_id) {
    return 'person_id must not be set for admin or store_owner accounts';
  }

  if (body.role !== 'customer' && !body.username) {
    return 'username is required for admin or store_owner accounts';
  }

  if (body.password !== undefined && !validatePasswordStrength(body.password)) {
    return 'password must be at least 8 characters';
  }

  return null;
}

export function canManageAccountOfRole(callerRole: Role, targetRole: Role): boolean {
  if (callerRole === 'admin') return true;
  if (callerRole === 'store_owner') return targetRole === 'customer';
  return false;
}
