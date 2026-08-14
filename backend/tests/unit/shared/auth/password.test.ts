import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  passwordStrengthMessage,
  validatePasswordStrength,
  verifyPassword,
} from '../../../../src/shared/auth/password.js';

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

  it('rejects passwords over 16 characters', () => {
    expect(validatePasswordStrength('a'.repeat(17))).toBe(false);
  });

  it('accepts passwords between 8 and 16 characters (inclusive), regardless of composition', () => {
    expect(validatePasswordStrength('12345678')).toBe(true);
    expect(validatePasswordStrength('a'.repeat(16))).toBe(true);
    expect(validatePasswordStrength('alllowercase')).toBe(true);
  });
});

describe('passwordStrengthMessage', () => {
  it('defaults to describing the "password" field', () => {
    expect(passwordStrengthMessage()).toBe('password must be between 8 and 16 characters');
  });

  it('accepts a custom field name', () => {
    expect(passwordStrengthMessage('newPassword')).toBe('newPassword must be between 8 and 16 characters');
  });
});
