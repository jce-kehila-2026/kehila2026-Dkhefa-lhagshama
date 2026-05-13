/**
 * Firebase Web SDK initialization (client-side).
 *
 * Reads NEXT_PUBLIC_FIREBASE_* values from frontend/.env.local — pulled from
 * Firebase Console → Project Settings → Your apps → Web app → SDK config.
 *
 * Next.js hot-reloads modules in dev; guard against re-initializing.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp: FirebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
export const firebaseAuth: Auth = getAuth(firebaseApp);
export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);
