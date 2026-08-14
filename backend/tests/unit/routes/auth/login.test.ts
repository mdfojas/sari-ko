import { describe, expect, it } from 'vitest';
import { resolveHashToCompare } from '../../../../src/routes/auth/login.js';

describe('resolveHashToCompare', () => {
  it('returns the account password_hash when the account exists', () => {
    expect(resolveHashToCompare({ password_hash: 'real-hash' } as never)).toBe('real-hash');
  });

  it('returns a non-empty dummy hash when the account is null, so bcrypt still runs a real comparison', () => {
    const dummy = resolveHashToCompare(null);
    expect(typeof dummy).toBe('string');
    expect(dummy.length).toBeGreaterThan(0);
    expect(dummy).not.toBe('real-hash');
  });
});
