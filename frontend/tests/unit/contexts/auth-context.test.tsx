import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { clearToken, getToken, setToken } from '@/lib/token-storage';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/auth-client', () => ({
  loginRequest: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));
vi.mock('@/lib/token-storage', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('settles with no user when no token is stored', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(fetchCurrentUser).not.toHaveBeenCalled();
  });

  test('hydrates the user from /me when a token is already stored', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('existing-token');
    const user = { id: 1, username: 'admin', role: 'admin' as const, personId: null };
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const { result } = renderAuth();

    // Genuinely pending here (fetchCurrentUser hasn't resolved yet), unlike
    // the no-token case where there's no real async gap before settling.
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(user);
  });

  test('clears the token if hydration fails (expired/invalid token)', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('stale-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('401'));

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(clearToken).toHaveBeenCalled();
  });

  test('login stores the token, sets the user, and navigates to the role landing page', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('new-jwt');
    const user = { id: 3, username: 'juan1', role: 'customer' as const, personId: 1 };
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(user);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('juan1', 'secret123');
    });

    expect(setToken).toHaveBeenCalledWith('new-jwt');
    expect(result.current.user).toEqual(user);
    expect(push).toHaveBeenCalledWith('/my-ledger');
  });

  test('login propagates a failure without storing a token or setting a user', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (loginRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid credentials'));

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('juan1', 'wrong-password');
      })
    ).rejects.toThrow('invalid credentials');

    expect(setToken).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  test('logout clears the token, clears the user, and navigates to /login', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(clearToken).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(push).toHaveBeenCalledWith('/login');
  });

  test('useAuth throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
