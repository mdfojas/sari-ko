'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRequireAuth } from '@/hooks/use-auth-guards';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { TopbarProvider } from '@/contexts/topbar-context';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  useRequireAuth();
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
    return null;
  }

  return (
    <TopbarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-bg p-7">{children}</main>
        </div>
      </div>
    </TopbarProvider>
  );
}
