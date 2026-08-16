import { beforeEach, describe, expect, test } from 'vitest';
import { clearToken, getToken, setToken } from '@/lib/token-storage';

describe('token-storage', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
