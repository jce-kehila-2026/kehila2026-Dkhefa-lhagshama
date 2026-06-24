/**
 * Cloud Functions (2nd gen) entrypoint — wraps the Express app as an HTTPS
 * function named `api`. Firebase Hosting rewrites /api/** to this function, so
 * the browser calls the same origin as the site (no CORS) and Express receives
 * the original /api/... path unchanged.
 *
 * Credentials: on Cloud Functions the runtime service account provides
 * Application Default Credentials automatically, so firebaseAdmin's
 * applicationDefault() works with no key file (GOOGLE_APPLICATION_CREDENTIALS
 * must NOT be set in the deployed env — the .env file is excluded from the
 * functions upload via firebase.json `ignore`).
 */
// Runtime: nodejs22 (set in firebase.json functions.runtime). Node 20 was
// deprecated by Google (decommission 2026-10-30); 22 is the current LTS.
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { app } from '@/app';
import { installProcessSafetyNets } from '@/middleware/errorHandler';

// Last-resort process listeners so a stray async error logs loudly instead of
// silently terminating the Cloud Functions instance (audit CRITICAL).
installProcessSafetyNets();

// Region matches the Hosting frameworksBackend region (us-east1) so Hosting and
// the function are co-located. maxInstances caps concurrent instances to bound
// cost / Firestore connection fan-out on the free-tier staging project.
setGlobalOptions({ region: 'us-east1', maxInstances: 10 });

// invoker: 'public' grants allUsers the run.invoker role so the function accepts
// unauthenticated HTTP calls. This is required for the Hosting /api/** rewrite,
// which forwards requests anonymously. App-level auth is still enforced inside
// Express (Firebase ID-token verification on every protected route).
export const api = onRequest({ invoker: 'public' }, app);
