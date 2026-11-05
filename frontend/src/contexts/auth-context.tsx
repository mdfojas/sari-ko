'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { clearToken, getToken, setToken, syncTokenFromStorage, TOKEN_KEY } from '@/lib/token-storage';
import { landingPathForRole, LOGIN_PATH, type AuthUser } from '@/lib/auth-types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  // Re-reads /me, e.g. after the username changed, so the sidebar and profile show the new one.
  // Resolves true if /me was re-read, false if it could not be (the caller stays signed in either way).
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bumped by anything that decides who this tab is (a storage event, login,
  // logout). Every async answer checks it, so a slow, older answer can never
  // overwrite a newer decision.
  const syncId = useRef(0);

  useEffect(() => {
    const id = syncId.current;
    const stillCurrent = () => id === syncId.current;

    async function hydrate() {
      const token = getToken();
      if (!token) {
        if (stillCurrent()) setIsLoading(false);
        return;
      }
      try {
        const current = await fetchCurrentUser();
        if (stillCurrent()) setUser(current);
      } catch (err) {
        // Only a real 401 means the token itself is invalid/expired. Any
        // other failure (network blip, the backend cold-starting) is
        // transient — clearing the token here would wrongly log out a
        // returning user just because the backend was briefly unreachable.
        if (stillCurrent() && err instanceof ApiError && err.status === 401) {
          clearToken();
        }
      } finally {
        if (stillCurrent()) setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  // The token lives in localStorage, which every tab shares, and every request
  // reads it fresh. When another tab signs in as someone else (or out), this tab
  // would keep showing the old user while its requests carry the new token. So
  // on any change to the token: drop the cache, drop the user, and re-resolve
  // who the token now belongs to. A newer change always wins over an older,
  // slower answer.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      // A null key means storage.clear().
      if (event.key !== null && event.key !== TOKEN_KEY) return;
      const id = ++syncId.current;
      queryClient.clear();
      setUser(null);

      if (!syncTokenFromStorage()) {
        setIsLoading(false);
        router.replace(LOGIN_PATH);
        return;
      }
      setIsLoading(true);
      fetchCurrentUser()
        .then((current) => {
          if (id === syncId.current) setUser(current);
        })
        .catch(() => {
          // Fail closed: no user, but keep the token (the failure may be transient).
        })
        .finally(() => {
          if (id === syncId.current) setIsLoading(false);
        });
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient, router]);

  async function login(username: string, password: string) {
    const token = await loginRequest(username, password);
    const id = ++syncId.current;
    // The query cache outlives a session: start every sign-in empty, so one
    // user never briefly sees the previous user's cached data.
    queryClient.clear();
    setToken(token);
    try {
      const current = await fetchCurrentUser();
      // Another tab changed who this tab is while we waited: that decision wins.
      if (id !== syncId.current) return;
      setUser(current);
      router.replace(landingPathForRole(current.role));
    } catch (err) {
      // Same: a late failure must not wipe the token another tab signed in with.
      if (id !== syncId.current) return;
      // The password check succeeded (we got a token), but the login
      // attempt as a whole didn't — don't leave a token behind with no
      // user attached to it.
      clearToken();
      throw err;
    }
  }

  async function refreshUser(): Promise<boolean> {
    const id = syncId.current;
    try {
      const current = await fetchCurrentUser();
      // A late answer for a token this tab no longer holds must not become the user.
      if (id !== syncId.current) return false;
      setUser(current);
      return true;
    } catch {
      // Keep the current user and token: a failed refresh (network blip) must
      // never sign anyone out, and the change itself already succeeded.
      return false;
    }
  }

  function logout() {
    syncId.current++;
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
