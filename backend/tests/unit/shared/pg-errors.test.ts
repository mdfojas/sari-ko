import { describe, expect, it } from 'vitest';
import { isForeignKeyViolation, isUniqueViolation } from '../../../src/shared/pg-errors.js';

describe('isForeignKeyViolation', () => {
  it('returns true for a Postgres foreign-key-violation error', () => {
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
  });

  it('returns false for a different Postgres error code', () => {
    expect(isForeignKeyViolation({ code: '23505' })).toBe(false);
  });

  it('returns false for a plain Error with no code', () => {
    expect(isForeignKeyViolation(new Error('boom'))).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation('23503')).toBe(false);
  });
});

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
