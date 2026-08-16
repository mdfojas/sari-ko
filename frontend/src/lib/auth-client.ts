import { apiFetch } from './api-client';
import type { AuthUser, Role } from './auth-types';

interface RawAccount {
  id: number;
  username: string;
  role: Role;
  person_id: number | null;
}

function toAuthUser(raw: RawAccount): AuthUser {
  return { id: raw.id, username: raw.username, role: raw.role, personId: raw.person_id };
}

export async function loginRequest(username: string, password: string): Promise<string> {
  const { token } = await apiFetch<{ token: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return token;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const raw = await apiFetch<RawAccount>('/me');
  return toAuthUser(raw);
}
