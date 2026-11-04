import { describe, expect, it } from 'vitest';
import { validateCreatePayment, validateUpdatePayment } from '../../../../src/routes/payments/validation.js';

const INT_MAX = 2_147_483_647;

describe('validateCreatePayment', () => {
  it('accepts a whole-centavo amount, with or without a note', () => {
    expect(validateCreatePayment({ amount: 1000 })).toBeNull();
    expect(validateCreatePayment({ amount: 1000, note: 'partial' })).toBeNull();
    expect(validateCreatePayment({ amount: 1000, note: null })).toBeNull();
    expect(validateCreatePayment({ amount: INT_MAX })).toBeNull();
  });

  it.each([undefined, null])('requires an amount (%s)', (amount) => {
    expect(validateCreatePayment({ amount } as never)).toBe('amount is required and must be greater than 0');
  });

  it.each([0, -5, '5', Number.NaN])('rejects the amount %s', (amount) => {
    expect(validateCreatePayment({ amount } as never)).toBe('amount is required and must be greater than 0');
  });

  it('rejects a fractional amount, since money is whole centavos', () => {
    expect(validateCreatePayment({ amount: 12.5 })).toBe('amount must be a whole number of centavos');
  });

  it('rejects an amount over the INTEGER ceiling with a message, not a database overflow', () => {
    expect(validateCreatePayment({ amount: INT_MAX + 1 })).toBe('amount can be at most ₱21,474,836.47');
  });

  it.each([undefined, null, 'text', 42, []])('rejects a body that is not a JSON object (%s)', (body) => {
    expect(validateCreatePayment(body as never)).toBe('Request body must be a JSON object');
  });

  it('rejects a note that is not text, or that holds a NUL byte', () => {
    expect(validateCreatePayment({ amount: 100, note: 5 } as never)).toBe('note must be text or null');
    expect(validateCreatePayment({ amount: 100, note: 'a\u0000b' })).toBe('Text cannot contain NUL characters');
  });
});

describe('validateUpdatePayment', () => {
  it('requires at least one field', () => {
    expect(validateUpdatePayment({})).toBe('No updatable fields provided');
  });

  it('accepts a valid amount or a note on its own', () => {
    expect(validateUpdatePayment({ amount: 500 })).toBeNull();
    expect(validateUpdatePayment({ note: 'fixed typo' })).toBeNull();
  });

  it('applies the same amount rules as create', () => {
    expect(validateUpdatePayment({ amount: 0 })).toBe('amount must be greater than 0');
    expect(validateUpdatePayment({ amount: 12.5 })).toBe('amount must be a whole number of centavos');
    expect(validateUpdatePayment({ amount: INT_MAX + 1 })).toBe('amount can be at most ₱21,474,836.47');
  });
});
