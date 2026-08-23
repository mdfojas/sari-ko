import type { Role } from './auth-types';

// Single source of truth for which roles may access which (app) route,
// taken directly from feature-specs/04-frontend-dashboard.md's routing
// table. Each page's useRequireRole(...) call should read from here rather
// than redeclaring its own allowed-roles list, so the two can't drift as
// more routes land (Tickets 4.5-4.9).
export const ROUTE_ACCESS: Record<string, Role[]> = {
  '/products': ['admin', 'store_owner'],
  '/store-prices': ['admin', 'store_owner'],
  '/loans': ['admin', 'store_owner'],
  '/accounts': ['admin', 'store_owner'],
  '/profile': ['admin', 'store_owner', 'customer'],
  '/my-ledger': ['customer'],
  '/catalog': ['customer'],
};
