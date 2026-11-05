import { apiFetch } from './api-client';
import type { Role } from './auth-types';

export interface Account {
  id: number;
  username: string;
  role: Role;
  person_id: number | null;
  created_at: string;
  updated_at: string;
}

// The backend returns the plaintext password exactly once, on creation.
export type CreatedAccount = Account & { password: string };

export interface CreateAccountInput {
  role: Role;
  username?: string;
  password?: string;
  person_id?: number;
}

export function listAccounts(): Promise<Account[]> {
  return apiFetch<Account[]>('/accounts');
}

export function createAccount(input: CreateAccountInput): Promise<CreatedAccount> {
  return apiFetch<CreatedAccount>('/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function deleteAccount(id: number): Promise<void> {
  return apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' });
}

// Omit `password` to have the backend generate one. Either way the resulting
// plaintext password comes back once and is never retrievable again.
export function resetAccountPassword(id: number, password?: string): Promise<{ password: string }> {
  return apiFetch<{ password: string }>(`/accounts/${id}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(password === undefined ? {} : { password }),
  });
}
