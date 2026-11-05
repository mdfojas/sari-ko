import { describe, expect, it } from 'vitest';
import {
  hasNul,
  INT_MAX,
  isNonBlankString,
  isPlainObject,
  isPositiveInteger,
  MAX_AMOUNT_TEXT,
} from '../../../src/shared/validation.js';

describe('shared validation helpers', () => {
  it('INT_MAX is the PostgreSQL INTEGER ceiling, in centavos', () => {
    expect(INT_MAX).toBe(2_147_483_647);
    expect(MAX_AMOUNT_TEXT).toBe('₱21,474,836.47');
  });

  it.each([[{}, true], [{ a: 1 }, true], [[], false], [null, false], [undefined, false], ['x', false], [5, false]])(
    'isPlainObject(%j) is %s',
    (value, expected) => expect(isPlainObject(value)).toBe(expected),
  );

  it.each([[1, true], [INT_MAX, true], [INT_MAX + 1, true], [0, false], [-1, false], [1.5, false], ['5', false], [NaN, false], [null, false]])(
    'isPositiveInteger(%j) is %s (range is checked separately)',
    (value, expected) => expect(isPositiveInteger(value)).toBe(expected),
  );

  it.each([['a', true], ['  a  ', true], ['', false], ['   ', false], [5, false], [null, false]])(
    'isNonBlankString(%j) is %s',
    (value, expected) => expect(isNonBlankString(value)).toBe(expected),
  );

  it('hasNul finds a NUL byte, which Postgres refuses in text', () => {
    expect(hasNul('a\u0000b')).toBe(true);
    expect(hasNul('ab')).toBe(false);
    expect(hasNul(5)).toBe(false);
  });
});
