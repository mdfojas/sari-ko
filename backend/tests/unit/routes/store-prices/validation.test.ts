import { describe, expect, it } from 'vitest';
import { hasStorePriceUpdate, validateCreateStorePrice } from '../../../../src/routes/store-prices/validation.js';

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
