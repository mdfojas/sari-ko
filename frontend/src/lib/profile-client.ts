import { apiFetch } from './api-client';

// Both resolve with no body (204). The backend re-checks the current
// password on every password change, even though the caller is signed in.
export function changeUsername(username: string): Promise<void> {
  return apiFetch<void>('/me/username', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>('/me/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
