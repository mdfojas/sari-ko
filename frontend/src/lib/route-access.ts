import type { Role } from './auth-types';

const APP_ROUTES = [
  '/products',
  '/store-prices',
  '/loans',
  '/accounts',
  '/profile',
  '/my-ledger',
  '/catalog',
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

// Single source of truth for which roles may access which (app) route, taken
// directly from feature-specs/04-frontend-dashboard.md's routing table. It is
// enforced in two places: the (app) layout (useRouteAccess, a fail-closed
// backstop that covers every page) and each page's own useRequireRole.
// Keyed by AppRoute, so a mistyped route is a compile error, not a runtime
// `undefined.includes`.
export const ROUTE_ACCESS: Record<AppRoute, readonly Role[]> = {
  '/products': ['admin', 'store_owner'],
  '/store-prices': ['admin', 'store_owner'],
  '/loans': ['admin', 'store_owner'],
  '/accounts': ['admin', 'store_owner'],
  '/profile': ['admin', 'store_owner', 'customer'],
  '/my-ledger': ['customer'],
  '/catalog': ['customer'],
};

// The roles allowed on whatever page `pathname` belongs to — an exact route or
// anything nested under it (a future /loans/12) — or null if no listed route
// owns it, which callers should treat as "deny".
export function rolesForPath(pathname: string): readonly Role[] | null {
  // startsWith(`${r}/`) already covers a trailing slash ('/products/').
  const route = APP_ROUTES.find((r) => pathname === r || pathname.startsWith(`${r}/`));
  return route ? ROUTE_ACCESS[route] : null;
}
