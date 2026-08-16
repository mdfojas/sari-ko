import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearToken, getToken, setToken } from '@/lib/token-storage';

describe('token-storage', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
