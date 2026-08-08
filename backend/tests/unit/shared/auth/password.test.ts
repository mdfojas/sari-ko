import { describe, expect, it } from 'vitest';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../../../src/shared/auth/password.js';

describe('hashPassword / verifyPassword', () => {
  it('produces a different hash on repeated calls for the same input', async () => {
    const hashA = await hashPassword('correct-horse');
    const hashB = await hashPassword('correct-horse');

    expect(hashA).not.toBe(hashB);
  });

  it('verifies the original plaintext against its hash', async () => {
    const hash = await hashPassword('correct-horse');

    expect(await verifyPassword('correct-horse', hash)).toBe(true);
  });

  it('rejects the wrong plaintext against a hash', async () => {
    const hash = await hashPassword('correct-horse');

    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('rejects passwords under 8 characters', () => {
    expect(validatePasswordStrength('short1')).toBe(false);
  });

  it('accepts an 8+ character password regardless of composition', () => {
    expect(validatePasswordStrength('alllowercase')).toBe(true);
    expect(validatePasswordStrength('12345678')).toBe(true);
  });
});
