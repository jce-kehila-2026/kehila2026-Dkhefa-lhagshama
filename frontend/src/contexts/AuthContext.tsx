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
import { doc, onSnapshot } from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '../lib/firebase';
import {
  ensureRoleAssigned,
  loginWithEmail,
  logout as fbLogout,
  registerWithEmail,
} from '../lib/auth';
import type { Role } from '../types';

// Re-export the canonical role type so existing `import { Role } from
// '../contexts/AuthContext'` call sites keep working.
export type { Role };

/**
 * Stored role, as read from the Firebase custom claim. Wider than the gated
 * {@link Role} union because the claim may legitimately hold the legacy
 * `businessOwner` value (admin user management persists it). It is kept as a
 * raw role for display, but is *not* part of the gated {@link Role} set, so
 * {@link hasRole} treats it as satisfying no gated role.
 */
type StoredRole = Role | 'businessOwner';

/**
 * Debounced session-presence signal, derived from `user` + `loading`.
 * - `pending`  — auth is still resolving, OR a transient null is inside the
 *   grace window (Firebase briefly emits a null user during a token refresh).
 * - `authenticated` — a user is present.
 * - `anonymous` — the user has been absent past the grace window (a real sign-out).
 * Route guards key off this single signal instead of each running their own
 * redirect timer, which keeps the no-flicker behavior in exactly one place.
 */
export type SessionState = 'pending' | 'authenticated' | 'anonymous';

/** Grace window (ms) before a (loading=false, user=null) tick counts as a real
 *  sign-out. Long enough to ride out Firebase's transient token-refresh nulls. */
const SESSION_GRACE_MS = 600;

interface AuthContextValue {
  user: User | null;
  /**
   * The signed-in user's role from custom claims, or `null` while resolving /
   * when signed out. Kept nullable for existing consumers (e.g. AdminGate's
   * `role !== 'admin'` check); prefer {@link hasRole} for gating.
   */
  role: StoredRole | null;
  loading: boolean;
  /** Debounced session presence; see {@link SessionState}. */
  sessionState: SessionState;
  /** True when the user's role satisfies `r`. Admin satisfies any role. */
  hasRole: (r: Role) => boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Force a token refresh and re-read claims (e.g. after a role change). */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Pull the `role` custom claim off the user's id token and narrow it to a known
// StoredRole. `forceRefresh` re-fetches from the token endpoint (used after a
// role change); otherwise the cached token is read. Unknown/absent claim -> null.
async function readRoleFromToken(user: User, forceRefresh = false): Promise<StoredRole | null> {
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
  const [role, setRole] = useState<StoredRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      setUser(u);
      if (u) {
        try {
          // Read the role from the *cached* token first. A forced refresh on
          // every onAuthStateChanged init (e.g. on each navigation that
          // re-initialises the SDK) repeatedly hit the token endpoint and was
          // observed to invalidate live sessions on staging — a failed refresh
          // cleared the persisted user and bounced the page to /login mid-flow.
          // The cached token already carries the role claim for an established
          // session, so reading it without a network round-trip is both correct
          // and stable. We only force a refresh when the cached token has no
          // usable role (a freshly-promoted user or a brand-new account), where
          // the network cost is justified to pick up the new claim immediately.
          let nextRole = await readRoleFromToken(u, /*forceRefresh*/ false);
          // Self-heal: a signed-in user with no role can't submit requests.
          // Assign the default `beneficiary` role, then re-read with a forced
          // token refresh so the new claim is reflected immediately.
          if (!nextRole) {
            const assigned = await ensureRoleAssigned();
            if (assigned) nextRole = await readRoleFromToken(u, /*forceRefresh*/ true);
          }
          setRole(nextRole);
        } catch {
          // A transient token read failure must not nuke an established role.
          // Keep whatever role we already resolved (no-op setRole) rather than
          // forcing it to null, which would make role-gated UI flap. Only an
          // explicit sign-out (u === null, handled below) clears the role.
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // #87 — Disabled account handling.
  // Subscribe to the signed-in user's `users/{uid}` doc. If an admin flips
  // `disabled` to true while they're using the app, sign them out immediately
  // and send them to /account-disabled. We use a Firestore realtime listener so
  // the lockout is near-instant rather than waiting for the next API call.
  useEffect(() => {
    if (!user) return;

    let stopped = false;
    const ref = doc(firebaseDb, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (stopped) return;
        if (snap.exists() && snap.data()?.disabled === true) {
          stopped = true;
          try {
            try { window.sessionStorage?.removeItem('pff:saveProfileOffer'); } catch { /* noop */ }
            await fbLogout();
          } finally {
            if (typeof window !== 'undefined') {
              window.location.replace('/account-disabled');
            }
          }
        }
      },
      () => {
        // Read errors (e.g. rules deny when no user doc exists) are non-fatal:
        // the account simply isn't flagged disabled. Swallow and carry on.
      },
    );

    return () => {
      stopped = true;
      unsub();
    };
  }, [user]);

  // Debounced session-presence. A (loading=false, user=null) tick can be a real
  // sign-out OR a transient null mid token-refresh. We hold off declaring the
  // session `anonymous` until the grace window elapses with the user still gone;
  // if the user reappears first, the timer is cancelled. Centralising this here
  // means route guards never need their own redirect timers.
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    if (loading || user) {
      setGraceElapsed(false);
      return;
    }
    const handle = setTimeout(() => setGraceElapsed(true), SESSION_GRACE_MS);
    return () => clearTimeout(handle);
  }, [loading, user]);

  const sessionState: SessionState = loading
    ? 'pending'
    : user
      ? 'authenticated'
      : graceElapsed
        ? 'anonymous'
        : 'pending';

  // Admin is a superset: it satisfies any role check. Otherwise an exact match.
  // (Fixes the old exact-match bug where an admin failed a `volunteer` check.)
  const hasRole = useCallback(
    (r: Role) => role === 'admin' || role === r,
    [role],
  );

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
    // PII hygiene: the post-submit save-to-profile stash (#67) must never
    // survive an account switch in the same tab. It is also uid-bound on
    // read (MyRequestsPage) — this is belt and braces.
    try { window.sessionStorage?.removeItem('pff:saveProfileOffer'); } catch { /* noop */ }
    await fbLogout();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, role, loading, sessionState, hasRole, login, register, logout, refreshClaims,
  }), [user, role, loading, sessionState, hasRole, login, register, logout, refreshClaims]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Consumer hook for the auth context. Throws if used outside <AuthProvider>.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
