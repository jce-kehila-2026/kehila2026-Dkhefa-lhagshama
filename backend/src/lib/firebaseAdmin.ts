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

function resolveStorageBucketName(): string {
  const configured =
    process.env.FIREBASE_STORAGE_BUCKET
    ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

  if (configured) {
    // Strip .appspot.com or .firebasestorage.app suffix to get just the bucket name
    let bucket = configured;
    if (bucket.endsWith('.firebasestorage.app')) {
      bucket = bucket.replace(/\.firebasestorage\.app$/, '');
    } else if (bucket.endsWith('.appspot.com')) {
      bucket = bucket.replace(/\.appspot\.com$/, '');
    }
    return bucket;
  }

  // Default: just the base name without suffix
  return process.env.GCLOUD_PROJECT
    ? process.env.GCLOUD_PROJECT
    : 'push-for-fulfillment-staging';
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
