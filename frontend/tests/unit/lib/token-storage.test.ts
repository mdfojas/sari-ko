import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearToken, getToken, setToken, syncTokenFromStorage, TOKEN_KEY } from '@/lib/token-storage';

describe('token-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    syncTokenFromStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('returns null when nothing is stored', () => {
    expect(getToken()).toBeNull();
  });

  test('returns the token after it is set', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  test('returns null after the token is cleared', () => {
    setToken('abc123');
    clearToken();
    expect(getToken()).toBeNull();
  });

  test('getToken returns null when localStorage is unavailable (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getToken()).toBeNull();
  });

  test('setToken does not throw when localStorage is unavailable (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => setToken('abc123')).not.toThrow();
  });

  test('clearToken does not throw when localStorage is unavailable (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => clearToken()).not.toThrow();
  });

  // localStorage is shared by every tab; the token a tab *uses* must not be.
  // Otherwise a tab keeps showing one user while its requests carry whichever
  // token the last-signed-in tab wrote.
  describe('binding a tab to the token it authenticated with', () => {
    test('keeps returning this tab\'s token after another tab overwrites localStorage', () => {
      setToken('alice-token');
      localStorage.setItem(TOKEN_KEY, 'bob-token'); // what another tab does

      expect(getToken()).toBe('alice-token');
    });

    test('keeps returning this tab\'s token after another tab removes it', () => {
      setToken('alice-token');
      localStorage.removeItem(TOKEN_KEY);

      expect(getToken()).toBe('alice-token');
    });

    // The key is shared: a tab signing out must not sign out whoever else is
    // signed in under it.
    test('clearToken leaves another tab\'s token in storage, but still signs this tab out', () => {
      setToken('alice-token');
      localStorage.setItem(TOKEN_KEY, 'bob-token'); // another tab signed in as bob

      clearToken();

      expect(localStorage.getItem(TOKEN_KEY)).toBe('bob-token');
      expect(getToken()).toBeNull();
    });

    test('a tab with no token of its own never removes another tab\'s token', () => {
      syncTokenFromStorage(); // nothing stored: this tab holds no token
      localStorage.setItem(TOKEN_KEY, 'bob-token');

      clearToken();

      expect(localStorage.getItem(TOKEN_KEY)).toBe('bob-token');
    });

    test('clearToken still removes the stored token when it is this tab\'s own', () => {
      setToken('alice-token');
      clearToken();
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    test('syncTokenFromStorage adopts whatever is stored now, and returns it', () => {
      setToken('alice-token');
      localStorage.setItem(TOKEN_KEY, 'bob-token');

      expect(syncTokenFromStorage()).toBe('bob-token');
      expect(getToken()).toBe('bob-token');
    });

    test('syncTokenFromStorage adopts "no token" when another tab signed out', () => {
      setToken('alice-token');
      localStorage.removeItem(TOKEN_KEY);

      expect(syncTokenFromStorage()).toBeNull();
      expect(getToken()).toBeNull();
    });

    test('a tab binds to the stored token the first time it reads it', async () => {
      localStorage.setItem(TOKEN_KEY, 'stored-at-startup');
      vi.resetModules();
      const fresh = await import('@/lib/token-storage');

      expect(fresh.getToken()).toBe('stored-at-startup');
      localStorage.setItem(fresh.TOKEN_KEY, 'bob-token');
      expect(fresh.getToken()).toBe('stored-at-startup');
    });

    test('syncTokenFromStorage returns null when localStorage is unavailable (SSR)', () => {
      vi.stubGlobal('localStorage', undefined);
      expect(syncTokenFromStorage()).toBeNull();
    });
  });
});
