import { describe, expect, test } from 'vitest';
import { landingPathForRole } from '@/lib/auth-types';

describe('landingPathForRole', () => {
  test('sends admin to /products', () => {
    expect(landingPathForRole('admin')).toBe('/products');
  });

  test('sends store_owner to /products', () => {
    expect(landingPathForRole('store_owner')).toBe('/products');
  });

  test('sends customer to /my-ledger', () => {
    expect(landingPathForRole('customer')).toBe('/my-ledger');
  });
});
