'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRequireAuth, useRedirectIfAuthenticated } from '@/hooks/use-auth-guards';

export default function HomePage() {
  // Together these cover both directions: unauthenticated -> /login,
  // authenticated -> the role's landing page.
  useRequireAuth();
  useRedirectIfAuthenticated();
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-text-muted">
        Loading…
      </main>
    );
  }

  return null;
}
