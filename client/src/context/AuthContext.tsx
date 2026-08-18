import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode, useRef } from 'react';
import { api, User, setAccessToken, setAuthFailureHandler } from '../api';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, signOut as firebaseSignOut } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isRefreshing = useRef(false);

  const refreshUser = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;
    try {
      const refreshRes = await fetch(
        `${import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'}/api/auth/refresh`,
        { method: 'POST', credentials: 'include' },
      );
      if (refreshRes.ok) {
        const data = (await refreshRes.json()) as { accessToken: string; user: User };
        setAccessToken(data.accessToken);
        setUser(data.user);
      } else {
        setAccessToken(null);
        setUser(null);
      }
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      isRefreshing.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => { setUser(null); setAccessToken(null); });
    refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken(true);
      const { accessToken, user: dbUser } = await api.auth.firebaseLogin({ idToken });
      setAccessToken(accessToken);
      setUser(dbUser);
    } catch (error: any) {
      // Ignore if user just closed the popup
      if (error.code !== 'auth/popup-closed-by-user') {
        throw new Error(error.message || 'Google sign-in failed');
      }
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // 1. Try Firebase login first (for users who reset their password or signed up via Firebase)
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken(true);
      const { accessToken, user: dbUser } = await api.auth.firebaseLogin({ idToken });
      setAccessToken(accessToken);
      setUser(dbUser);
    } catch (firebaseError: any) {
      // 2. Fallback to local DB login (for seeded users or legacy users before Firebase migration)
      try {
        const { accessToken, user } = await api.auth.login({ email, password });
        setAccessToken(accessToken);
        setUser(user);
      } catch (localError: any) {
        // If local login also fails, throw the original firebase error or local error
        if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/user-not-found') {
          throw new Error('Invalid email or password');
        }
        throw localError;
      }
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    const { accessToken, user } = await api.auth.signup({ email, password, name });
    setAccessToken(accessToken);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* ignore */ }
    try { await firebaseSignOut(auth); } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, loginWithGoogle, signup, logout, refreshUser }), [user, loading, login, loginWithGoogle, signup, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

