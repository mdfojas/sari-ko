'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRequireAuth } from '@/hooks/use-auth-guards';

// Bare-bones on purpose: the sidebar/topbar chrome is Ticket 4.3's job. This
// layout only owns the auth guard every dashboard route sits behind.
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  useRequireAuth();
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return null;
  }

  return <>{children}</>;
}
