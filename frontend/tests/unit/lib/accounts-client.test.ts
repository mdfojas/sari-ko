import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createAccount, deleteAccount, listAccounts, resetAccountPassword } from '@/lib/accounts-client';
import { apiFetch } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiFetch: vi.fn() }));

describe('accounts-client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('listAccounts fetches GET /accounts', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listAccounts();
    expect(apiFetch).toHaveBeenCalledWith('/accounts');
  });

  test('createAccount POSTs the body to /accounts', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 5, password: 'generated1' });
    const result = await createAccount({ role: 'customer', person_id: 2 });
    expect(apiFetch).toHaveBeenCalledWith('/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'customer', person_id: 2 }),
    });
    expect(result.password).toBe('generated1');
  });

  test('deleteAccount DELETEs /accounts/:id', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await deleteAccount(7);
    expect(apiFetch).toHaveBeenCalledWith('/accounts/7', { method: 'DELETE' });
  });

  test('resetAccountPassword PATCHes /accounts/:id/password and returns the new password', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ password: 'newpass123' });
    const result = await resetAccountPassword(7, 'newpass123');
    expect(apiFetch).toHaveBeenCalledWith('/accounts/7/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'newpass123' }),
    });
    expect(result).toEqual({ password: 'newpass123' });
  });

  test('resetAccountPassword sends an empty body when the password should be auto-generated', async () => {
    (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ password: 'auto' });
    await resetAccountPassword(7);
    expect(apiFetch).toHaveBeenCalledWith('/accounts/7/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });
});
