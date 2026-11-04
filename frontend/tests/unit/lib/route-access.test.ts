import { describe, expect, test } from 'vitest';
import { ROUTE_ACCESS, rolesForPath } from '@/lib/route-access';
import { landingPathForRole, type Role } from '@/lib/auth-types';

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

describe('rolesForPath', () => {
  test('finds the allowed roles for a listed route', () => {
    expect(rolesForPath('/products')).toEqual(['admin', 'store_owner']);
    expect(rolesForPath('/my-ledger')).toEqual(['customer']);
  });

  test('a nested path inherits its parent route (e.g. a future /loans/12)', () => {
    expect(rolesForPath('/loans/12')).toEqual(['admin', 'store_owner']);
  });

  test('tolerates a trailing slash', () => {
    expect(rolesForPath('/products/')).toEqual(['admin', 'store_owner']);
  });

  test('does not match a route that merely shares a prefix', () => {
    expect(rolesForPath('/loansharks')).toBeNull();
    expect(rolesForPath('/products-archive')).toBeNull();
  });

  test('returns null for a path that is not listed, so callers can deny it by default', () => {
    expect(rolesForPath('/reports')).toBeNull();
    expect(rolesForPath('/')).toBeNull();
  });
});

// useRouteAccess sends a denied user to landingPathForRole(role). If that page
// were itself off-limits to the role it would redirect forever.
describe('every role can reach its own landing page', () => {
  test.each(['admin', 'store_owner', 'customer'] as Role[])('%s', (role) => {
    expect(rolesForPath(landingPathForRole(role))).toContain(role);
  });
});
