'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { landingPathForRole, LOGIN_PATH, type Role } from '@/lib/auth-types';
import { rolesForPath } from '@/lib/route-access';

export function useRequireAuth(): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(LOGIN_PATH);
    }
  }, [isLoading, user, router]);
}

// allowedRoles must be a stable reference (module-level constant) — it's an
// effect dependency, and a new array literal on every render would redirect
// on every render instead of only once.
export function useRequireRole(allowedRoles: readonly Role[]): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.replace(landingPathForRole(user.role));
    }
  }, [isLoading, user, router, allowedRoles]);
}

// Fail-closed backstop for the whole (app) layout: whichever page is showing,
// its route must be listed in ROUTE_ACCESS and the user's role must be allowed
// there. A page that forgets its own useRequireRole, or a route nobody added to
// the map, is denied rather than quietly open. Returns whether to render.
export function useRouteAccess(): boolean {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowedRoles = rolesForPath(pathname);
  const allowed = Boolean(user && allowedRoles?.includes(user.role));

  useEffect(() => {
    if (!isLoading && user && !allowed) {
      router.replace(landingPathForRole(user.role));
    }
  }, [isLoading, user, allowed, router]);

  return allowed;
}

export function useRedirectIfAuthenticated(): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(landingPathForRole(user.role));
    }
  }, [isLoading, user, router]);
}
