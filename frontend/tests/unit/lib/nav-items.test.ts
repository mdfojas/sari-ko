import { describe, expect, test } from 'vitest';
import { navItemsForRole } from '@/lib/nav-items';

describe('navItemsForRole', () => {
  test('gives admin the full operational nav', () => {
    expect(navItemsForRole('admin').map((i) => i.href)).toEqual([
      '/products',
      '/store-prices',
      '/loans',
      '/accounts',
    ]);
  });

  test('gives store_owner the same full operational nav as admin', () => {
    expect(navItemsForRole('store_owner').map((i) => i.href)).toEqual(
      navItemsForRole('admin').map((i) => i.href)
    );
  });

  test('gives customer only their ledger and a read-only catalog', () => {
    expect(navItemsForRole('customer').map((i) => i.href)).toEqual(['/my-ledger', '/catalog']);
  });
});
