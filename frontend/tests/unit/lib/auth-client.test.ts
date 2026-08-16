import { describe, expect, test, vi } from 'vitest';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('loginRequest', () => {
  test('posts the username and password to /auth/login and returns the token', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'my-jwt' });

    const token = await loginRequest('juan', 'secret123');

    expect(token).toBe('my-jwt');
    expect(apiFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'juan', password: 'secret123' }),
    });
  });
});

describe('fetchCurrentUser', () => {
  test('fetches /me and maps person_id to personId', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 3,
      username: 'juan1',
      role: 'customer',
      person_id: 1,
    });

    const user = await fetchCurrentUser();

    expect(apiFetch).toHaveBeenCalledWith('/me');
    expect(user).toEqual({ id: 3, username: 'juan1', role: 'customer', personId: 1 });
  });

  test('maps a null person_id (admin/store_owner) to a null personId', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      username: 'admin',
      role: 'admin',
      person_id: null,
    });

    const user = await fetchCurrentUser();

    expect(user.personId).toBeNull();
  });
});
