import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../../../src/shared/auth/jwt.js';

const payload = { accountId: 1, username: 'owner1', role: 'store_owner' as const, personId: null };

describe('signToken / verifyToken', () => {
  it('round-trips the exact payload', () => {
    const token = signToken(payload);

    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('throws for a tampered/invalid-signature token', () => {
    const token = signToken(payload);
    const tampered = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a');

    expect(() => verifyToken(tampered)).toThrow();
  });

  it('throws for garbage input', () => {
    expect(() => verifyToken('not-a-real-token')).toThrow();
  });

  it('throws for an expired token', () => {
    const expiredToken = signToken(payload, { expiresIn: '-1s' });

    expect(() => verifyToken(expiredToken)).toThrow();
  });
});
