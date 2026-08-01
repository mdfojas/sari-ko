import { describe, expect, it } from 'vitest';
import { hasProductUpdate, validateCreateProduct } from '../../../../src/routes/products/validation.js';

describe('validateCreateProduct', () => {
  it('requires a name', () => {
    expect(validateCreateProduct({ store_prices: [{ store_name: 'A', price: 100, selected: true }] })).toBe(
      'name is required',
    );
  });

  it('requires at least one store price', () => {
    expect(validateCreateProduct({ name: 'Coke', store_prices: [] })).toBe(
      'At least one store price is required',
    );
  });

  it('requires one store price to be marked selected', () => {
    expect(
      validateCreateProduct({ name: 'Coke', store_prices: [{ store_name: 'A', price: 100 }] }),
    ).toBe('One store price must be marked as selected');
  });

  it('returns null when the body is valid', () => {
    expect(
      validateCreateProduct({
        name: 'Coke',
        store_prices: [{ store_name: 'A', price: 100, selected: true }],
      }),
    ).toBeNull();
  });
});

describe('hasProductUpdate', () => {
  it('returns false when no updatable field is present', () => {
    expect(hasProductUpdate({})).toBe(false);
  });

  it('returns true when any single updatable field is present', () => {
    expect(hasProductUpdate({ name: 'New name' })).toBe(true);
    expect(hasProductUpdate({ barcode: null })).toBe(true);
    expect(hasProductUpdate({ selected_store_price_id: 5 })).toBe(true);
  });
});
