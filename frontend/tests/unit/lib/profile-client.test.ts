import { beforeEach, describe, expect, test, vi } from 'vitest';
import { changePassword, changeUsername } from '@/lib/profile-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('profile-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('changeUsername PATCHes /me/username with the new username', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await changeUsername('maria2');
    expect(apiFetch).toHaveBeenCalledWith('/me/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'maria2' }),
    });
  });

  test('changePassword PATCHes /me/password with the current and the new password', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await changePassword('old-password', 'brand-new-pass');
    expect(apiFetch).toHaveBeenCalledWith('/me/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'brand-new-pass' }),
    });
  });
});
