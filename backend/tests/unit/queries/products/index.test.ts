import { describe, expect, it } from 'vitest';
import { isUniqueViolation } from '../../../../src/queries/products/index.js';

describe('isUniqueViolation', () => {
  it('returns true for a Postgres unique-violation error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns false for a different Postgres error code', () => {
    expect(isUniqueViolation({ code: '23502' })).toBe(false);
  });

  it('returns false for a plain Error with no code', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });
});
