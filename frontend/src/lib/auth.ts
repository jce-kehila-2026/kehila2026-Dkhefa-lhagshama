/**
 * Auth helpers — thin wrappers around the Firebase Web SDK.
 *
 * The Express backend handles role assignment via custom claims; this module
 * only deals with the Firebase Auth client surface.
 */
import {
  createUserWithEmailAndPassword,
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

  return cred;
}

export function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(firebaseAuth, email, password);
}

export function logout(): Promise<void> {
  return fbSignOut(firebaseAuth);
}

/** Returns the current user's ID token (refreshed if expired). null if signed out. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
