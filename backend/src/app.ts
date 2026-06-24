/**
 * Express app factory for the Push for Fulfillment backend.
 *
 * This module builds and exports the configured Express `app` WITHOUT binding a
 * port. Two entrypoints consume it:
 *   - `src/index.ts`    — local dev / standalone: imports `app` and calls listen().
 *   - `src/function.ts` — Cloud Functions (2nd gen): wraps `app` in onRequest().
 *
 * Routes live under `src/routes/<uc>.ts` and are mounted here. Authenticated
 * routes use the `authenticate` middleware which verifies the Firebase ID token
 * sent in the Authorization header.
 */
import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet'; // #83

import { initializeFirebaseAdmin } from '@/lib/firebaseAdmin';
import adminRouter from '@/routes/admin';
import adminCategoriesRouter from '@/routes/adminCategories';
import adminDirectoryRouter from '@/routes/adminDirectory';
import adminVolunteersRouter from '@/routes/adminVolunteers';
import adminChatsRouter from '@/routes/adminChats';
import adminRequestsRouter from '@/routes/adminRequests';
import adminUsersRouter from '@/routes/adminUsers';
import adminStatsRouter from '@/routes/adminStats';
import adminInsightsRouter from '@/routes/adminInsights';
import answersRouter from '@/routes/answers';
import authRouter from '@/routes/auth';
import businessesRouter from '@/routes/businesses';
import categoriesRouter from '@/routes/categories';
import chatsRouter from '@/routes/chats';
import profileRouter from '@/routes/profile';
import ratingsRouter from '@/routes/ratings';
import requestsRouter from '@/routes/requests';
import suggestionsRouter from '@/routes/suggestions';
import uploadsRouter from '@/routes/uploads';
import usersRouter from '@/routes/users';
import volunteersRouter from '@/routes/volunteers';
import volunteerAppRouter from '@/routes/volunteerApp';
import { authenticate } from '@/middleware/auth';
import { requireNotDisabled } from '@/middleware/requireNotDisabled';
import { requireVerifiedEmail } from '@/middleware/requireVerifiedEmail';
import { authWriteLimiter, globalLimiter } from '@/middleware/rateLimit'; // #82
import { errorHandler } from '@/middleware/errorHandler';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
// Dev origins: localhost, 127.0.0.1, and any private-LAN IPv4 (so the app works
// when opened via the machine's network address, e.g. http://192.168.x.x:3000).
const LOCAL_ORIGIN_RE =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;

// ── CORS allowlist (#83) ──────────────────────────────────────────────────────
// Origins are driven by CORS_ALLOWED_ORIGINS (comma-separated). FRONTEND_ORIGIN
// is always allowed for backwards-compat, and localhost/127.0.0.1 dev origins
// keep working regardless.
//
// In production the frontend is served from Firebase Hosting and proxied to this
// function via the /api/** rewrite. That is same-origin, BUT browsers still
// attach an `Origin` header to unsafe-method requests (POST/PUT/PATCH/DELETE) —
// even same-origin ones — so those requests ARE CORS-checked. (Same-origin GETs
// send no Origin header, which is why reads worked but every write was blocked.)
// The deployed function has no .env, so CORS_ALLOWED_ORIGINS/FRONTEND_ORIGIN are
// unset there; we must therefore always allow the Hosting origins. They are
// derived from the runtime project id (exposed as GCLOUD_PROJECT /
// GOOGLE_CLOUD_PROJECT on Cloud Functions) with a known-project fallback.
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);
ALLOWED_ORIGINS.add(FRONTEND_ORIGIN);

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.FIREBASE_PROJECT_ID ??
  'push-for-fulfillment-staging';
ALLOWED_ORIGINS.add(`https://${PROJECT_ID}.web.app`);
ALLOWED_ORIGINS.add(`https://${PROJECT_ID}.firebaseapp.com`);

// Initialize Firebase Admin SDK before any route handler runs.
initializeFirebaseAdmin();

const app = express();

// On managed runtimes (Cloud Functions / Cloud Run, detected via K_SERVICE)
// there is a Google proxy in front of the app, so the client IP arrives via
// X-Forwarded-For. Trust it there so req.ip and the rate limiters key off the
// real client. Locally there is no proxy, so we leave trust proxy off (default)
// to avoid express-rate-limit's permissive-trust-proxy warning.
if (process.env.K_SERVICE || process.env.FUNCTION_TARGET) {
  app.set('trust proxy', true);
}

// ── Security headers (#83) ────────────────────────────────────────────────────
// helmet() sets X-DNS-Prefetch-Control, X-Frame-Options, HSTS, X-XSS-Protection,
// X-Content-Type-Options, Referrer-Policy, Permissions-Policy, etc.
app.use(helmet());

// ── CORS allowlist (#83) — driven by CORS_ALLOWED_ORIGINS env ─────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN_RE.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
}));

// ── Global rate limiter (#82) — 300 req / 15 min per IP ──────────────────────
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));

// Health check (unauthenticated). Used by deploy targets and by frontend
// startup to verify connectivity. Mounted at BOTH /health and /api/health so it
// is reachable through the Hosting /api/** rewrite (which only forwards /api/*).
const health = (_req: Request, res: Response): void => {
  res.json({ ok: true, service: 'push-for-fulfillment-backend' });
};
app.get('/health', health);
app.get('/api/health', health);

// /api/me — smoke-test endpoint. Returns the authenticated user's identity
// + role claim. Useful for client-side "am I logged in?" checks and for
// curl-testing the auth pipeline end-to-end.
app.get('/api/me', authenticate, (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }
  res.json({ uid: req.user.uid, email: req.user.email, role: req.user.role ?? null });
});

// Route mounts.
// Auth + write routes get the stricter 30 req/15 min limiter (#82).
//
// authenticate + requireNotDisabled run mount-wide on the authenticated
// mutation routers so a soft-disabled account (users/{uid}.disabled == true)
// gets a 403 server-side, not just the cosmetic client redirect. The per-route
// `authenticate` inside each router stays (idempotent local JWT verify) so
// routers remain self-contained. /api/auth is excluded — its routes run before
// a user could be considered disabled and must stay reachable.
const authedMutation = [authenticate, requireNotDisabled];

// Email-verification gate (audit H-1). The requireVerifiedEmail middleware was
// fully built but wired to ZERO routes, so an account with an unverified email
// could still submit requests (with a national-ID number) and post messages.
// We now wire it onto the content-write paths — but GATED behind
// ENFORCE_EMAIL_VERIFICATION so it stays OFF by default on staging/demo, where a
// freshly-registered account isn't verified yet and must still be able to submit
// during a live demo. Flip ENFORCE_EMAIL_VERIFICATION=true in production to
// activate it. When off, verifiedMutation === authedMutation (transparent).
const ENFORCE_EMAIL_VERIFICATION = process.env.ENFORCE_EMAIL_VERIFICATION === 'true';
const verifiedMutation = ENFORCE_EMAIL_VERIFICATION
  ? [authenticate, requireNotDisabled, requireVerifiedEmail]
  : authedMutation;

app.use('/api/auth',       authWriteLimiter, authRouter);
app.use('/api/chats',      authWriteLimiter, ...verifiedMutation, chatsRouter);
app.use('/api/profile',    authWriteLimiter, ...authedMutation, profileRouter);
app.use('/api/requests',   authWriteLimiter, ...verifiedMutation, requestsRouter);
app.use('/api/uploads',    authWriteLimiter, ...authedMutation, uploadsRouter);
app.use('/api/users',      authWriteLimiter, ...authedMutation, usersRouter);
app.use('/api/ratings',    authWriteLimiter, ...authedMutation, ratingsRouter); // #80
app.use('/api/businesses', businessesRouter);
app.use('/api/answers',    answersRouter);
// Public taxonomy read. Deliberately NOT behind authWriteLimiter (like
// /api/answers): it's a read-only GET fetched on page load by pickers and
// label resolution, so the strict 30 req/15 min write limiter would throttle
// normal browsing. globalLimiter still applies as the abuse backstop.
app.use('/api/categories', categoriesRouter);
app.use('/api/suggestions', suggestionsRouter); // UC-01 A1: public, no limiter
// Admin sub-routers (Stream 4: #73 #74 #75 #76 #77). Each enforces
// authenticate + requireRole('admin') internally. Mount BEFORE the generic
// adminRouter so /api/admin/{volunteers,requests,users,stats} resolve to their
// dedicated routers; adminRouter keeps /api/admin/pending|approve|reject|etc.
//
// NOTE: admin routes are deliberately NOT behind the strict authWriteLimiter
// (30 req/15 min). The admin dashboard fires several GETs per page load, and an
// authenticated admin should never be throttled during normal use. They still
// pass through the app-wide globalLimiter (300 req/15 min) as a coarse abuse
// backstop, and every route enforces requireRole('admin') internally.
app.use('/api/admin/volunteers', adminVolunteersRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/chats',      adminChatsRouter);
app.use('/api/admin/requests',   adminRequestsRouter);
app.use('/api/admin/users',      adminUsersRouter);
app.use('/api/admin/stats',      adminStatsRouter);
app.use('/api/admin/insights',   adminInsightsRouter);
app.use('/api/admin/directory',  adminDirectoryRouter);
app.use('/api/admin',      adminRouter);
app.use('/api/volunteers', authWriteLimiter, ...authedMutation, volunteersRouter);
// Volunteer operational app (reqs 14–19): own dashboard, pool, claims, drops.
app.use('/api/volunteer', ...authedMutation, volunteerAppRouter);

// Catch-all 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' });
});

// Central error handler (audit CRITICAL). MUST be the last `app.use` — Express
// only routes errors to a 4-argument middleware, and only one registered after
// all routes. Any error thrown synchronously, or forwarded via `next(err)` from
// an `asyncHandler`-wrapped handler, lands here and becomes a clean 500 with no
// stack-trace leak. See middleware/errorHandler.ts for the full rationale.
app.use(errorHandler);

// Named export for index.ts/function.ts; ALLOWED_ORIGINS is re-exported for
// reuse (e.g. socket/CORS checks elsewhere). Default export mirrors `app`.
export { app, ALLOWED_ORIGINS };
export default app;
