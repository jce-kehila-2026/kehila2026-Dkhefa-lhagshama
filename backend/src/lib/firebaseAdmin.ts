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

export function initializeFirebaseAdmin(): admin.app.App {
  if (initialized) {
    return admin.app();
  }

  // `applicationDefault()` reads GOOGLE_APPLICATION_CREDENTIALS from env.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
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
