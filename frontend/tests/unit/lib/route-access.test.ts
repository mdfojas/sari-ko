import { describe, expect, test } from 'vitest';
import { ROUTE_ACCESS } from '@/lib/route-access';

describe('ROUTE_ACCESS', () => {
  test('matches the routing table in feature-specs/04-frontend-dashboard.md', () => {
    expect(ROUTE_ACCESS).toEqual({
      '/products': ['admin', 'store_owner'],
      '/store-prices': ['admin', 'store_owner'],
      '/loans': ['admin', 'store_owner'],
      '/accounts': ['admin', 'store_owner'],
      '/profile': ['admin', 'store_owner', 'customer'],
      '/my-ledger': ['customer'],
      '/catalog': ['customer'],
    });
  });
});
