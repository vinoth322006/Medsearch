import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, User, setAccessToken, setAuthFailureHandler, getAccessToken } from '../api';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      // Always attempt a silent refresh via the HttpOnly cookie.
      // This restores the session after a page reload (access token is in-memory only).
      const refreshRes = await fetch(
        `${import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'}/api/auth/refresh`,
        { method: 'POST', credentials: 'include' },
      );
      if (refreshRes.ok) {
        const data = (await refreshRes.json()) as { accessToken: string; user: User };
        setAccessToken(data.accessToken);
        setUser(data.user);
      } else {
        // No valid refresh cookie — user is not logged in
        setAccessToken(null);
        setUser(null);
      }
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => { setUser(null); setAccessToken(null); });
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await api.auth.login({ email, password });
    setAccessToken(accessToken);
    setUser(user);
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const { accessToken, user } = await api.auth.signup({ email, password, name });
    setAccessToken(accessToken);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, signup, logout, refreshUser }), [user, loading, login, signup, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

