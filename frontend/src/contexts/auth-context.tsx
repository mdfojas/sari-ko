'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { clearToken, getToken, setToken } from '@/lib/token-storage';
import { landingPathForRole, LOGIN_PATH, type AuthUser } from '@/lib/auth-types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  // Re-reads /me, e.g. after the username changed, so the sidebar and profile show the new one.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        setUser(await fetchCurrentUser());
      } catch (err) {
        // Only a real 401 means the token itself is invalid/expired. Any
        // other failure (network blip, the backend cold-starting) is
        // transient — clearing the token here would wrongly log out a
        // returning user just because the backend was briefly unreachable.
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
        }
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  async function login(username: string, password: string) {
    const token = await loginRequest(username, password);
    // The query cache outlives a session: start every sign-in empty, so one
    // user never briefly sees the previous user's cached data.
    queryClient.clear();
    setToken(token);
    try {
      const current = await fetchCurrentUser();
      setUser(current);
      router.replace(landingPathForRole(current.role));
    } catch (err) {
      // The password check succeeded (we got a token), but the login
      // attempt as a whole didn't — don't leave a token behind with no
      // user attached to it.
      clearToken();
      throw err;
    }
  }

  async function refreshUser() {
    try {
      setUser(await fetchCurrentUser());
    } catch {
      // Keep the current user and token: a failed refresh (network blip) must
      // never sign anyone out, and the change itself already succeeded.
    }
  }

  function logout() {
    clearToken();
    queryClient.clear();
    setUser(null);
    router.replace(LOGIN_PATH);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
