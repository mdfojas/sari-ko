import { describe, expect, it } from 'vitest';
import { isDataException, isForeignKeyViolation, isUniqueViolation } from '../../../src/shared/pg-errors.js';

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

describe('isDataException', () => {
  it.each(['22001', '22003', '22007', '22008', '22021', '22P02'])('is true for the bad-input code %s', (code) => {
    expect(isDataException({ code })).toBe(true);
  });

  // Constraint violations and server faults are not "bad input to a route that
  // forgot to validate": they must keep their own handling.
  it.each(['23503', '23505', '23514', '23502', '40001', '42P01', '53300', '2BP01', '22012', '22P05'])(
    'is false for %s',
    (code) => {
      expect(isDataException({ code })).toBe(false);
    },
  );

  it('is false for non-errors and errors without a code', () => {
    expect(isDataException(null)).toBe(false);
    expect(isDataException(new Error('x'))).toBe(false);
    expect(isDataException({ code: 22021 })).toBe(false);
  });
});
