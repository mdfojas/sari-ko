'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { landingPathForRole, LOGIN_PATH } from '@/lib/auth-types';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? landingPathForRole(user.role) : LOGIN_PATH);
  }, [isLoading, user, router]);

  return null;
}
