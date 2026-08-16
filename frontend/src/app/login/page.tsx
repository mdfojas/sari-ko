'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRedirectIfAuthenticated } from '@/hooks/use-auth-guards';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  useRedirectIfAuthenticated();
  const { login, user, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading || user) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      if (err instanceof ApiError) {
        // Deliberately generic for any auth-rejection status — never reveal
        // whether the username existed, matching the backend's timing-safe
        // login design.
        setError('Invalid username or password.');
      } else {
        // Distinct from the above: a network/timeout/server error is not
        // the same as wrong credentials, and conflating them makes a
        // backend outage indistinguishable from a typo.
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar">
      <form onSubmit={handleSubmit} className="w-80 rounded-lg bg-card p-8">
        <h1 className="mb-6 text-lg font-bold text-text">Sign in to SariKo</h1>
        {error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        )}
        <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded border border-border px-3 py-2 text-text"
        />
        <label className="mb-1 block text-xs font-semibold text-text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded border border-border px-3 py-2 text-text"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-accent py-2 font-semibold text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
