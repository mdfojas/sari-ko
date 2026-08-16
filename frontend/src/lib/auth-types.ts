export type Role = 'admin' | 'store_owner' | 'customer';

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  personId: number | null;
}

export function landingPathForRole(role: Role): string {
  return role === 'customer' ? '/my-ledger' : '/products';
}

export const LOGIN_PATH = '/login';
