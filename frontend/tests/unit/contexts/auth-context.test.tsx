import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { clearToken, getToken, setToken, syncTokenFromStorage } from '@/lib/token-storage';
import { ApiError } from '@/lib/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('@/lib/auth-client', () => ({
  loginRequest: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));
vi.mock('@/lib/token-storage', () => ({
  TOKEN_KEY: 'sariko.token',
  syncTokenFromStorage: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

let queryClient: QueryClient;

function renderAuth() {
  queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
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

  test('refreshUser re-reads /me so a changed username shows up without a reload', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('existing-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, username: 'old', role: 'admin', personId: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.username).toBe('old'));

    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, username: 'renamed', role: 'admin', personId: null });
    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.username).toBe('renamed');
    expect(clearToken).not.toHaveBeenCalled();
  });

  test('a failed refreshUser keeps the current user and the token', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('existing-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, username: 'old', role: 'admin', personId: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.username).toBe('old'));

    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network blip'));
    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.username).toBe('old');
    expect(clearToken).not.toHaveBeenCalled();
  });

  // The query cache outlives the session: without this, the next person to sign
  // in on the same browser tab would briefly see the previous person's cached
  // ledger before it refetched.
  test('logout empties the query cache so the next user never sees the previous one\'s data', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('existing-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 3, username: 'juan1', role: 'customer', personId: 1 });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).not.toBeNull());
    queryClient.setQueryData(['me', 'ledger'], [{ id: 1 }]);

    act(() => result.current.logout());

    expect(queryClient.getQueryData(['me', 'ledger'])).toBeUndefined();
  });

  test('login empties the query cache before the new user lands', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('new-jwt');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 4, username: 'maria', role: 'customer', personId: 2 });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queryClient.setQueryData(['me', 'ledger'], [{ id: 1 }]);

    await act(async () => {
      await result.current.login('maria', 'secret123');
    });

    expect(queryClient.getQueryData(['me', 'ledger'])).toBeUndefined();
  });

  describe('another tab changes the shared token', () => {
    const alice = { id: 3, username: 'alice', role: 'customer' as const, personId: 1 };
    const bob = { id: 4, username: 'bob', role: 'customer' as const, personId: 2 };

    async function signedInAsAlice() {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(alice);
      const rendered = renderAuth();
      await waitFor(() => expect(rendered.result.current.user).toEqual(alice));
      queryClient.setQueryData(['me', 'ledger'], [{ id: 1 }]);
      return rendered;
    }

    const storageEvent = (key: string | null) =>
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key }));
      });

    // The token in localStorage is shared by every tab, and every request reads it
    // fresh. Without this, tab 1 keeps showing "alice" in the sidebar while its
    // requests now carry bob's token, and the page fills with bob's ledger.
    test('another tab signing in as someone else empties the cache and switches to that user', async () => {
      const { result } = await signedInAsAlice();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(bob);

      storageEvent('sariko.token');

      expect(queryClient.getQueryData(['me', 'ledger'])).toBeUndefined();
      await waitFor(() => expect(result.current.user).toEqual(bob));
    });

    test('while the new user is being resolved, the old user is never shown alongside the new token', async () => {
      const { result } = await signedInAsAlice();
      let resolveBob: (u: typeof bob) => void = () => {};
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise((r) => (resolveBob = r)));

      storageEvent('sariko.token');

      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(true);
      await act(async () => {
        resolveBob(bob);
      });
      expect(result.current.user).toEqual(bob);
      expect(result.current.isLoading).toBe(false);
    });

    test('another tab logging out empties the cache, signs this tab out and goes to /login', async () => {
      const { result } = await signedInAsAlice();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue(null);

      storageEvent('sariko.token');

      expect(queryClient.getQueryData(['me', 'ledger'])).toBeUndefined();
      await waitFor(() => expect(result.current.user).toBeNull());
      expect(replace).toHaveBeenCalledWith('/login');
    });

    test('localStorage.clear() in another tab (a null key) counts as the token going away', async () => {
      const { result } = await signedInAsAlice();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue(null);

      storageEvent(null);

      await waitFor(() => expect(result.current.user).toBeNull());
      expect(queryClient.getQueryData(['me', 'ledger'])).toBeUndefined();
    });

    test('an unrelated storage key changes nothing', async () => {
      const { result } = await signedInAsAlice();
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockClear();

      storageEvent('some.other.key');

      expect(queryClient.getQueryData(['me', 'ledger'])).toEqual([{ id: 1 }]);
      expect(result.current.user).toEqual(alice);
      expect(fetchCurrentUser).not.toHaveBeenCalled();
    });

    test('if the new user cannot be loaded, this tab fails closed (no user) and keeps the token', async () => {
      const { result } = await signedInAsAlice();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network blip'));

      storageEvent('sariko.token');

      await waitFor(() => expect(result.current.user).toBeNull());
      expect(clearToken).not.toHaveBeenCalled();
    });

    test('a slow answer for an older token never overwrites a newer one', async () => {
      const { result } = await signedInAsAlice();
      let resolveOld: (u: typeof bob) => void = () => {};
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((r) => (resolveOld = r)))
        .mockResolvedValueOnce(alice);

      storageEvent('sariko.token');
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      storageEvent('sariko.token');
      await waitFor(() => expect(result.current.user).toEqual(alice));
      await act(async () => {
        resolveOld(bob);
      });

      expect(result.current.user).toEqual(alice);
    });

    test('stops listening once the provider unmounts', async () => {
      const rendered = await signedInAsAlice();
      rendered.unmount();
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockClear();

      storageEvent('sariko.token');

      expect(fetchCurrentUser).not.toHaveBeenCalled();
    });

    test('this tab adopts the other tab\'s token as the one its requests use', async () => {
      await signedInAsAlice();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(bob);

      storageEvent('sariko.token');

      expect(syncTokenFromStorage).toHaveBeenCalledTimes(1);
    });

    // The page-load /me call can still be in flight when the event arrives. If its
    // late answer were applied, the tab would show "alice" while holding bob's token.
    test('a slow answer from the initial page load never overwrites a newer user', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      let resolveInitial: (u: typeof alice) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((r) => (resolveInitial = r)))
        .mockResolvedValueOnce(bob);
      const { result } = renderAuth();

      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent('sariko.token');
      await waitFor(() => expect(result.current.user).toEqual(bob));
      await act(async () => {
        resolveInitial(alice);
      });

      expect(result.current.user).toEqual(bob);
    });

    test('a slow answer from the initial page load never brings back a user who was signed out in another tab', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      let resolveInitial: (u: typeof alice) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise((r) => (resolveInitial = r)));
      const { result } = renderAuth();

      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue(null);
      storageEvent('sariko.token');
      await act(async () => {
        resolveInitial(alice);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    test('a slow answer for an older token cannot end the loading state while a newer one is pending', async () => {
      const { result } = await signedInAsAlice();
      let resolveFirst: (u: typeof bob) => void = () => {};
      let resolveSecond: (u: typeof alice) => void = () => {};
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
        .mockReturnValueOnce(new Promise((r) => (resolveSecond = r)));

      storageEvent('sariko.token');
      storageEvent('sariko.token');
      await act(async () => {
        resolveFirst(bob);
      });
      // The first answer is out of date: still waiting for the second, with no user.
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();

      await act(async () => {
        resolveSecond(alice);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(alice);
    });

    test('the initial page-load answer cannot end the loading state while the newer user is still being resolved', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      let resolveInitial: (u: typeof alice) => void = () => {};
      let resolveBob: (u: typeof bob) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((r) => (resolveInitial = r)))
        .mockReturnValueOnce(new Promise((r) => (resolveBob = r)));
      const { result } = renderAuth();

      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent('sariko.token');
      await act(async () => {
        resolveInitial(alice);
      });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();

      await act(async () => {
        resolveBob(bob);
      });
      expect(result.current.user).toEqual(bob);
      expect(result.current.isLoading).toBe(false);
    });

    test('a sign-out event that arrives during the initial load leaves isLoading false, not stuck', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      (fetchCurrentUser as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderAuth();
      expect(result.current.isLoading).toBe(true);

      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue(null);
      storageEvent('sariko.token');

      expect(result.current.isLoading).toBe(false);
    });
  });

  test('a slow page-load answer cannot overwrite a user who has since signed in on this tab', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('stale-token');
    let resolveInitial: (u: { id: number; username: string; role: 'customer'; personId: number }) => void = () => {};
    const maria = { id: 5, username: 'maria', role: 'customer' as const, personId: 2 };
    (fetchCurrentUser as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(new Promise((r) => (resolveInitial = r)))
      .mockResolvedValueOnce(maria);
    (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('maria-token');
    const { result } = renderAuth();

    await act(async () => {
      await result.current.login('maria', 'secret123');
    });
    await act(async () => {
      resolveInitial({ id: 3, username: 'alice', role: 'customer', personId: 1 });
    });

    expect(result.current.user).toEqual(maria);
  });

  test('a slow page-load answer cannot bring back a user who has since signed out on this tab', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
    let resolveInitial: (u: { id: number; username: string; role: 'customer'; personId: number }) => void = () => {};
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockReturnValueOnce(new Promise((r) => (resolveInitial = r)));
    const { result } = renderAuth();

    act(() => result.current.logout());
    await act(async () => {
      resolveInitial({ id: 3, username: 'alice', role: 'customer', personId: 1 });
    });

    expect(result.current.user).toBeNull();
  });

  describe('answers that arrive after another tab changed the token', () => {
    const alice = { id: 3, username: 'alice', role: 'customer' as const, personId: 1 };
    const bob = { id: 4, username: 'bob', role: 'customer' as const, personId: 2 };
    const storageEvent = () =>
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'sariko.token' }));
      });

    test('a login whose /me answer arrives late does not replace the user another tab signed in', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('alice-token');
      let resolveLoginMe: (u: typeof alice) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((r) => (resolveLoginMe = r)))
        .mockResolvedValueOnce(bob);
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginDone: Promise<void> = Promise.resolve();
      act(() => {
        loginDone = result.current.login('alice', 'secret123');
      });
      await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalledTimes(1));
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent();
      await waitFor(() => expect(result.current.user).toEqual(bob));
      await act(async () => {
        resolveLoginMe(alice);
        await loginDone;
      });

      expect(result.current.user).toEqual(bob);
      expect(replace).not.toHaveBeenCalledWith('/my-ledger');
    });

    test('a login that fails late does not wipe the token another tab signed in with', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (loginRequest as ReturnType<typeof vi.fn>).mockResolvedValue('alice-token');
      let rejectLoginMe: (e: Error) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((_, rej) => (rejectLoginMe = rej)))
        .mockResolvedValueOnce(bob);
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginDone: Promise<void> = Promise.resolve();
      act(() => {
        loginDone = result.current.login('alice', 'secret123');
      });
      await waitFor(() => expect(fetchCurrentUser).toHaveBeenCalledTimes(1));
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent();
      await waitFor(() => expect(result.current.user).toEqual(bob));
      (clearToken as ReturnType<typeof vi.fn>).mockClear();
      await act(async () => {
        rejectLoginMe(new Error('network blip'));
        await loginDone;
      });

      expect(clearToken).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(bob);
    });

    test('a profile refresh whose answer arrives late does not replace the user another tab signed in', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      let resolveRefresh: (u: typeof alice) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(alice)
        .mockReturnValueOnce(new Promise((r) => (resolveRefresh = r)))
        .mockResolvedValueOnce(bob);
      const { result } = renderAuth();
      await waitFor(() => expect(result.current.user).toEqual(alice));

      let refreshDone: Promise<boolean> = Promise.resolve(true);
      act(() => {
        refreshDone = result.current.refreshUser();
      });
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent();
      await waitFor(() => expect(result.current.user).toEqual(bob));
      let ok = true;
      await act(async () => {
        resolveRefresh(alice);
        ok = await refreshDone;
      });

      expect(result.current.user).toEqual(bob);
      expect(ok).toBe(false);
    });

    test('a stale 401 from the page-load /me never wipes the token of the user another tab signed in', async () => {
      (getToken as ReturnType<typeof vi.fn>).mockReturnValue('alice-token');
      let rejectInitial: (e: unknown) => void = () => {};
      (fetchCurrentUser as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(new Promise((_, rej) => (rejectInitial = rej)))
        .mockResolvedValueOnce(bob);
      const { result } = renderAuth();
      (syncTokenFromStorage as ReturnType<typeof vi.fn>).mockReturnValue('bob-token');
      storageEvent();
      await waitFor(() => expect(result.current.user).toEqual(bob));

      await act(async () => {
        rejectInitial(new ApiError(401, { error: 'invalid token' }));
      });

      expect(clearToken).not.toHaveBeenCalled();
      expect(result.current.user).toEqual(bob);
    });
  });

  test('refreshUser reports whether it worked', async () => {
    (getToken as ReturnType<typeof vi.fn>).mockReturnValue('existing-token');
    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, username: 'old', role: 'admin', personId: null });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user?.username).toBe('old'));

    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 1, username: 'new', role: 'admin', personId: null });
    let ok = false;
    await act(async () => {
      ok = await result.current.refreshUser();
    });
    expect(ok).toBe(true);

    (fetchCurrentUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('blip'));
    await act(async () => {
      ok = await result.current.refreshUser();
    });
    expect(ok).toBe(false);
  });
});
