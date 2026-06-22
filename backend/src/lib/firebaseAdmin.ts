/**
 * Firebase Admin SDK bootstrap + the single source of server-side Firestore/Auth/Storage handles.
 *
 * Every Express route and script in the backend reaches Firebase through here:
 * call initializeFirebaseAdmin() once at startup, then use db()/auth()/storage()
 * anywhere. Init is idempotent (guarded by the module-level `initialized` flag)
 * so repeated calls reuse the one admin app.
 *
 * Credentials: locally, applicationDefault() reads the service-account JSON path
 * in GOOGLE_APPLICATION_CREDENTIALS (downloaded from Firebase Console > Settings >
 * Service accounts; never committed, matched by `*-firebase-adminsdk-*.json` in
 * .gitignore). On managed runtimes (Cloud Functions / Cloud Run) it falls back to
 * the platform service account, no key file shipped.
 */
import * as fs from 'fs';

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

  // `applicationDefault()` reads GOOGLE_APPLICATION_CREDENTIALS from env. On
  // managed runtimes (Cloud Functions / Cloud Run) credentials come from the
  // runtime service account via the metadata server and no key file is shipped.
  // If GOOGLE_APPLICATION_CREDENTIALS is set (e.g. inherited from a deployed
  // .env) but points at a file that does not exist, drop it so
  // applicationDefault() falls back to the platform ADC instead of throwing.
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && !fs.existsSync(gac)) {
    // eslint-disable-next-line no-console
    console.log('[firebaseAdmin] credentials file not found; using platform ADC');
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

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
