'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { landingPathForRole, LOGIN_PATH } from '@/lib/auth-types';

export function useRequireAuth(): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(LOGIN_PATH);
    }
  }, [isLoading, user, router]);
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
