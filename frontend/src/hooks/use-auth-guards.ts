'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { landingPathForRole, LOGIN_PATH, type Role } from '@/lib/auth-types';

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
export function useRequireRole(allowedRoles: Role[]): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.replace(landingPathForRole(user.role));
    }
  }, [isLoading, user, router, allowedRoles]);
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
