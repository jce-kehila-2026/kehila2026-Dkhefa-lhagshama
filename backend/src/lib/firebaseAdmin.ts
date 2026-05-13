/**
 * Firebase Admin SDK initialization.
 *
 * Loads the service-account JSON from the path in
 * `GOOGLE_APPLICATION_CREDENTIALS`. The JSON is downloaded from
 * Firebase Console → Settings → Service accounts → Generate new private key.
 *
 * NEVER commit the service-account JSON to git. The pattern
 * `*-firebase-adminsdk-*.json` is in the repo's `.gitignore`.
 */
import * as admin from 'firebase-admin';

let initialized = false;

/**
 * Resolve the Firebase Storage bucket name for the Admin SDK.
 *
 * Modern Firebase projects use `<project>.firebasestorage.app`; older ones
 * use `<project>.appspot.com`. The Admin SDK wants the FULL bucket name
 * (with suffix) — passing just the project ID yields "specified bucket
 * does not exist". So we accept any of:
 *
 *   FIREBASE_STORAGE_BUCKET=push-for-fulfillment-staging.firebasestorage.app  (preferred)
 *   FIREBASE_STORAGE_BUCKET=push-for-fulfillment-staging                      (bare — we add the suffix)
 *
 * and ensure the returned value always has a suffix.
 */
function resolveStorageBucketName(): string {
  const configured =
    process.env.FIREBASE_STORAGE_BUCKET
    ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? process.env.GOOGLE_CLOUD_STORAGE_BUCKET
    ?? process.env.GCLOUD_PROJECT
    ?? 'push-for-fulfillment-staging';

  // If a suffix is already present, return as-is. Otherwise append the new
  // Firebase Storage suffix (any project created since 2024 uses this).
  if (configured.endsWith('.firebasestorage.app') || configured.endsWith('.appspot.com')) {
    return configured;
  }
  return `${configured}.firebasestorage.app`;
}

export function initializeFirebaseAdmin(): admin.app.App {
  if (initialized) {
    return admin.app();
  }

  // `applicationDefault()` reads GOOGLE_APPLICATION_CREDENTIALS from env.
  const storageBucket = resolveStorageBucketName();
  // eslint-disable-next-line no-console
  console.log('[firebaseAdmin] storage bucket:', storageBucket);

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket,
  });

  initialized = true;
  return admin.app();
}

/** Firestore handle. Call after `initializeFirebaseAdmin()`. */
export function db(): admin.firestore.Firestore {
  return admin.firestore();
}

/** Auth handle. Call after `initializeFirebaseAdmin()`. */
export function auth(): admin.auth.Auth {
  return admin.auth();
}

/** Storage bucket handle. Call after `initializeFirebaseAdmin()`. */
export function storage() {
  return admin.storage().bucket();
}
