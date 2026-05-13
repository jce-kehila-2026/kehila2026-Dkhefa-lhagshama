/**
 * AuthContext — single source of truth for the signed-in user + their role.
 *
 * Subscribes to Firebase's `onAuthStateChanged`, then fetches the user's
 * custom claims via `getIdTokenResult()` so the role is available everywhere.
 * Wraps `loginWithEmail`, `registerWithEmail`, `logout` for ergonomics.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { firebaseAuth } from '../lib/firebase';
import {
  loginWithEmail,
  logout as fbLogout,
  registerWithEmail,
} from '../lib/auth';

export type Role = 'beneficiary' | 'businessOwner' | 'volunteer' | 'admin';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readRoleFromToken(user: User, forceRefresh = false): Promise<Role | null> {
  const tokenResult = await user.getIdTokenResult(forceRefresh);
  const role = tokenResult.claims.role;
  if (
    role === 'beneficiary' ||
    role === 'businessOwner' ||
    role === 'volunteer' ||
    role === 'admin'
  ) {
    return role;
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (u) {
        try { setRole(await readRoleFromToken(u)); }
        catch { setRole(null); }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshClaims = useCallback(async () => {
    if (!firebaseAuth.currentUser) return;
    setRole(await readRoleFromToken(firebaseAuth.currentUser, /*forceRefresh*/ true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await loginWithEmail(email, password);
    // onAuthStateChanged will fire; role will be picked up there.
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await registerWithEmail(email, password);
    // The backend just set the `beneficiary` claim — force refresh the token
    // so the new role is reflected immediately.
    await refreshClaims();
  }, [refreshClaims]);

  const logout = useCallback(async () => {
    await fbLogout();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, role, loading, login, register, logout, refreshClaims,
  }), [user, role, loading, login, register, logout, refreshClaims]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
