/**
 * Auth helpers — thin wrappers around the Firebase Web SDK.
 *
 * The Express backend handles role assignment via custom claims; this module
 * only deals with the Firebase Auth client surface.
 */
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type UserCredential,
} from 'firebase/auth';

import { firebaseAuth } from './firebase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/**
 * Register with email + password. Creates the Firebase Auth user, then asks
 * the backend to set the `beneficiary` role custom claim. After the call
 * resolves, the caller should force-refresh the ID token to pick up the new
 * claim (AuthContext does this automatically).
 */
export async function registerWithEmail(email: string, password: string): Promise<UserCredential> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await cred.user.getIdToken();

  // Ask the backend to assign the default `beneficiary` role.
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const detail = await res.text();
    await cred.user.delete().catch(() => {});
    throw new Error(`role_assignment_failed: ${detail}`);
  }

  // #86 — send email verification immediately after successful registration.
  // Non-fatal: if this fails (e.g. network hiccup), the user can request
  // another one from the RequestsPage banner.
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // swallow — user will see the banner and can resend
  }

  return cred;
}

export function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export function logout(): Promise<void> {
  return fbSignOut(firebaseAuth);
}

/**
 * Ensure the signed-in user carries a role claim. Calls the idempotent backend
 * `/api/auth/register` endpoint, which assigns the default `beneficiary` role
 * to anyone without a privileged role and leaves admin/volunteer/businessOwner
 * untouched. Used on login to self-heal accounts created before role assignment
 * was wired up (or that signed in without ever registering through the app).
 * Returns true if the call succeeded so the caller can force-refresh the token.
 */
export async function ensureRoleAssigned(): Promise<boolean> {
  const user = firebaseAuth.currentUser;
  if (!user) return false;
  const idToken = await user.getIdToken();
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({}),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns the current user's ID token (refreshed if expired). null if signed out. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
