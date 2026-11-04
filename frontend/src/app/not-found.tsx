'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

// Renders inside the root layout (so AuthProvider is available). Routes that
// aren't built yet — e.g. a customer's /my-ledger landing page before Ticket
// 4.9 — land here with no app chrome, so a signed-in user needs a way out.
export default function NotFound() {
  const { user, isLoading, logout } = useAuth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-bold text-text">Page not found</h1>
      <p className="text-sm text-text-muted">This page doesn&apos;t exist (or isn&apos;t built yet).</p>
      {/* Held back until the session resolves, so Log out doesn't pop in late. */}
      {!isLoading && (
        <div className="flex gap-2">
          <Link href="/" className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-text">
            Go home
          </Link>
          {user && (
            <button
              type="button"
              onClick={logout}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </main>
  );
}
