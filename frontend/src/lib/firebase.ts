/**
 * Firebase Web SDK initialization (client-side singletons).
 *
 * The one place the browser app boots Firebase. Exports the shared `firebaseApp`,
 * `firebaseAuth` (login / ID-token / session: auth context, route guards, the
 * api client that attaches the bearer token), and `firebaseDb` (Firestore reads
 * + realtime listeners, e.g. chat). Server-trusted writes go through Express
 * (Admin SDK), not these handles.
 *
 * config reads NEXT_PUBLIC_FIREBASE_* from frontend/.env.local (Firebase Console
 * -> Project Settings -> Your apps -> Web app -> SDK config). Invariant: init runs
 * at most once per app instance; Next.js re-evaluates modules on hot-reload, so the
 * getApps() guard reuses the existing app instead of throwing on re-init.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// reuse the already-initialized app on hot-reload; only initialize on first load.
export const firebaseApp: FirebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
export const firebaseAuth: Auth = getAuth(firebaseApp);
export const firebaseDb: Firestore = getFirestore(firebaseApp);
// Note: the client Storage SDK is intentionally NOT instantiated here. All
// uploads go through the backend (Express + Admin SDK) — request attachments via
// /api/uploads and avatars via /api/profile/avatar — so there is no client-side
// Storage write path. Re-add getStorage() here only if a feature needs it.
