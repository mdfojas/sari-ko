import { describe, expect, it } from 'vitest';
import { hasStorePriceUpdate, validateCreateStorePrice, validateUpdateStorePrice } from '../../../../src/routes/store-prices/validation.js';

describe('validateCreateStorePrice', () => {
  it('requires store_name', () => {
    expect(validateCreateStorePrice({ price: 100 })).toBe('store_name and price are required');
  });

  it('requires price', () => {
    expect(validateCreateStorePrice({ store_name: 'Puregold' })).toBe('store_name and price are required');
  });

  it('returns null when both fields are present', () => {
    expect(validateCreateStorePrice({ store_name: 'Puregold', price: 100 })).toBeNull();
  });
});

describe('hasStorePriceUpdate', () => {
  it('returns false when neither field is present', () => {
    expect(hasStorePriceUpdate({})).toBe(false);
  });

  it('returns true when at least one field is present', () => {
    expect(hasStorePriceUpdate({ store_name: 'Puregold' })).toBe(true);
    expect(hasStorePriceUpdate({ price: 100 })).toBe(true);
  });
});

describe('validateCreateStorePrice, input shape', () => {
  const check = (body: unknown) => validateCreateStorePrice(body as never);

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(check(body)).toBe('Request body must be a JSON object');
  });

  it.each([123, {}, '   '])('rejects the store name %j', (store_name) => {
    expect(check({ store_name, price: 100 })).toBeTruthy();
  });

  it('rejects an over-long store name and a NUL byte', () => {
    expect(check({ store_name: 'x'.repeat(101), price: 100 })).toBe('The store name can be at most 100 characters');
    expect(check({ store_name: 'a\u0000b', price: 100 })).toBe('Text cannot contain NUL characters');
  });

  // A price of 0 used to reach the database CHECK and come back as a 500.
  it.each([0, -5])('rejects the price %s', (price) => {
    expect(check({ store_name: 'Puregold', price })).toBe('price must be greater than 0');
  });

  it.each([12.5, '5', Number.NaN])('rejects the price %s as not whole centavos', (price) => {
    expect(check({ store_name: 'Puregold', price })).toBe('price must be a whole number of centavos');
  });

  it('rejects a price over the INTEGER ceiling and accepts the ceiling itself', () => {
    expect(check({ store_name: 'Puregold', price: 2_147_483_648 })).toBe('price can be at most ₱21,474,836.47');
    expect(check({ store_name: 'Puregold', price: 2_147_483_647 })).toBeNull();
  });
});

describe('validateUpdateStorePrice', () => {
  const check = (body: unknown) => validateUpdateStorePrice(body as never);

  it.each([{ store_name: 'SM' }, { price: 100 }, { store_name: 'SM', price: 100 }])('accepts %j', (body) => {
    expect(check(body)).toBeNull();
  });

  it.each([undefined, null, 'x', 5, []])('rejects a body that is not a JSON object (%j)', (body) => {
    expect(check(body)).toBe('Request body must be a JSON object');
  });

  it('applies the same rules to whichever fields are present', () => {
    expect(check({ store_name: '   ' })).toBe('The store name cannot be blank');
    expect(check({ store_name: 5 })).toBe('name must be text');
    expect(check({ price: 0 })).toBe('price must be greater than 0');
    expect(check({ price: 2_147_483_648 })).toBe('price can be at most ₱21,474,836.47');
  });
});
