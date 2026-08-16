import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { clearToken, getToken, setToken } from '@/lib/token-storage';
import { ApiError } from '@/lib/api-client';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
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

  test('clears the token when hydration fails with a real 401 (expired/invalid token)', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('stale-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(401, { error: 'invalid token' })
    );

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(clearToken).toHaveBeenCalled();
  });

  test('does not clear the token when hydration fails with a transient error (network/cold-start timeout)', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('still-valid-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Request timed out after 120000ms')
    );

    const { result } = renderAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(clearToken).not.toHaveBeenCalled();
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
    expect(replace).toHaveBeenCalledWith('/my-ledger');
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

  test('login clears the token and rethrows if fetching the account fails after a successful password check', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('new-jwt');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network blip'));

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('juan1', 'secret123');
      })
    ).rejects.toThrow('network blip');

    // setToken was called (the password check genuinely succeeded), but the
    // login attempt as a whole didn't complete — no token should be left
    // behind, or a reload would see a token with no way to attribute it to
    // a user, and the caller has no way to know the password was correct.
    expect(clearToken).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(replace).not.toHaveBeenCalled();
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
    expect(replace).toHaveBeenCalledWith('/login');
  });

  test('useAuth throws when used outside an AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
