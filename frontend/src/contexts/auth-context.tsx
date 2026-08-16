'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, loginRequest } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-client';
import { clearToken, getToken, setToken } from '@/lib/token-storage';
import { landingPathForRole, LOGIN_PATH, type AuthUser } from '@/lib/auth-types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
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

  function logout() {
    clearToken();
    setUser(null);
    router.replace(LOGIN_PATH);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
