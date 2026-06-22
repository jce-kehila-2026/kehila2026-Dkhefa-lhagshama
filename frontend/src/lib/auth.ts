/**
 * Auth helpers - thin client-side wrappers around the Firebase Web SDK plus the
 * backend role-assignment handshake. Consumed by AuthContext and the login /
 * register pages; the only place the app touches Firebase Auth directly.
 *
 * Division of responsibility: Firebase owns identity (sign-up/in/out, ID
 * tokens), the Express backend owns roles via custom claims. After any call
 * that can change a claim (register/ensureRoleAssigned) the caller must
 * force-refresh the ID token so the new claim is visible client-side.
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
    // The Firebase user was created, but role assignment failed. Surface the
    // problem so the caller can decide whether to delete the account.
    const detail = await res.text();
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

/** Sign in an existing user with email + password. Roles come from the token's claims, set server-side. */
export function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

/** Sign the current user out of Firebase Auth (clears the local session). */
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
