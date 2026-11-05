import { describe, expect, it } from 'vitest';
import { validateCreateLineItem, validateUpdateLineItem } from '../../../../src/routes/line-items/validation.js';

const INT_MAX = 2_147_483_647;
const check = (body: unknown) => validateCreateLineItem(body as never);

describe('validateCreateLineItem — freeform', () => {
  it('accepts a description and a whole-centavo amount', () => {
    expect(check({ description: 'Kulang', amount: 1500 })).toBeNull();
    expect(check({ description: 'Kulang', amount: INT_MAX })).toBeNull();
  });

  it.each([{}, { description: 'x' }, { amount: 100 }, { description: '   ', amount: 100 }, { description: 5, amount: 100 }])(
    'requires a non-blank description and an amount (%j)',
    (body) => {
      expect(check(body)).toBe('description and amount are required for a freeform line item');
    },
  );

  it.each([0, -1])('rejects the amount %s (the column requires > 0) with a message, not a database error', (amount) => {
    expect(check({ description: 'x', amount })).toBe('amount must be greater than 0');
  });

  it.each([12.5, '5', Number.NaN])('rejects the amount %s as not a whole number of centavos', (amount) => {
    expect(check({ description: 'x', amount })).toBe('amount must be a whole number of centavos');
  });

  it('rejects an amount over the INTEGER ceiling', () => {
    expect(check({ description: 'x', amount: INT_MAX + 1 })).toBe('amount can be at most ₱21,474,836.47');
  });

  it('rejects a NUL byte in the description', () => {
    expect(check({ description: 'a\u0000b', amount: 100 })).toBe('Text cannot contain NUL characters');
  });
});

describe('validateCreateLineItem — catalog (product-linked)', () => {
  it('accepts a product id and a whole quantity', () => {
    expect(check({ product_id: 5, quantity: 3 })).toBeNull();
  });

  it('requires a quantity', () => {
    expect(check({ product_id: 5 })).toBe('quantity is required for a product-linked line item');
  });

  it.each([0, -1, 1.5, '2', Number.NaN])('rejects the quantity %s', (quantity) => {
    expect(check({ product_id: 5, quantity })).toBe('quantity must be a whole number of at least 1');
  });

  it('rejects a quantity over the INTEGER ceiling', () => {
    expect(check({ product_id: 5, quantity: INT_MAX + 1 })).toBe('quantity must be a whole number of at least 1');
  });

  it.each([0, -3, 1.5, '5', null])('rejects the product id %j', (product_id) => {
    expect(check({ product_id, quantity: 1 })).toBe('product_id must be a positive whole number');
  });
});

it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%s)', (body) => {
  expect(check(body)).toBe('Request body must be a JSON object');
});

it('rejects a product_id over the INTEGER ceiling', () => {
  expect(check({ product_id: INT_MAX + 1, quantity: 1 })).toBe('product_id must be a positive whole number');
  expect(check({ product_id: INT_MAX, quantity: 1 })).toBeNull();
});

describe('validateUpdateLineItem', () => {
  const upd = (body: unknown) => validateUpdateLineItem(body as never);

  it.each([{ description: 'new' }, { quantity: 3 }, { amount: 1200 }, { description: 'x', amount: 5 }, {}])('accepts %j', (body) => {
    expect(upd(body)).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%s)', (body) => {
    expect(upd(body)).toBe('Request body must be a JSON object');
  });

  it.each(['', '   ', 123, null, {}])('rejects the description %j', (description) => {
    expect(upd({ description })).toBe('description must be non-blank text');
  });

  it('rejects a NUL byte in the description', () => {
    expect(upd({ description: 'a\u0000b' })).toBe('Text cannot contain NUL characters');
  });

  it.each([-1, 0, 1.5, '2', Number.NaN, 1e10, INT_MAX + 1])('rejects the quantity %s', (quantity) => {
    expect(upd({ quantity })).toBe('quantity must be a whole number of at least 1');
  });

  it.each([-5, 0])('rejects the amount %s', (amount) => {
    expect(upd({ amount })).toBe('amount must be greater than 0');
  });

  it.each([12.5, '5', Number.NaN])('rejects the amount %s as not whole centavos', (amount) => {
    expect(upd({ amount })).toBe('amount must be a whole number of centavos');
  });

  it('rejects an amount over the INTEGER ceiling', () => {
    expect(upd({ amount: INT_MAX + 1 })).toBe('amount can be at most ₱21,474,836.47');
  });
});
