/**
 * Express bootstrap for the Push for Fulfillment backend.
 *
 * Routes live under `src/routes/<uc>.ts` and are mounted in this file.
 * Authenticated routes use the `authenticate` middleware which verifies the
 * Firebase ID token sent in the Authorization header.
 */
import 'dotenv/config';

import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet'; // #83

import { initializeFirebaseAdmin } from '@/lib/firebaseAdmin';
import adminRouter from '@/routes/admin';
import adminVolunteersRouter from '@/routes/adminVolunteers';
import adminRequestsRouter from '@/routes/adminRequests';
import adminUsersRouter from '@/routes/adminUsers';
import adminStatsRouter from '@/routes/adminStats';
import answersRouter from '@/routes/answers';
import authRouter from '@/routes/auth';
import businessesRouter from '@/routes/businesses';
import chatsRouter from '@/routes/chats';
import ratingsRouter from '@/routes/ratings';
import requestsRouter from '@/routes/requests';
import uploadsRouter from '@/routes/uploads';
import usersRouter from '@/routes/users';
import volunteersRouter from '@/routes/volunteers';
import { authenticate } from '@/middleware/auth';
import { authWriteLimiter, globalLimiter } from '@/middleware/rateLimit'; // #82

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
// Dev origins: localhost, 127.0.0.1, and any private-LAN IPv4 (so the app works
// when opened via the machine's network address, e.g. http://192.168.x.x:3000).
const LOCAL_ORIGIN_RE =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;

// ── CORS allowlist (#83) ──────────────────────────────────────────────────────
// Origins are driven by CORS_ALLOWED_ORIGINS (comma-separated). FRONTEND_ORIGIN
// is always allowed for backwards-compat, and localhost/127.0.0.1 dev origins
// keep working regardless.
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);
ALLOWED_ORIGINS.add(FRONTEND_ORIGIN);

// Initialize Firebase Admin SDK before any route handler runs.
initializeFirebaseAdmin();

const app = express();

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
// startup to verify connectivity.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'push-for-fulfillment-backend' });
});

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

// Route mounts — uncomment as each vertical-slice UC lands.
// Auth + write routes get the stricter 30 req/15 min limiter (#82).
app.use('/api/auth',       authWriteLimiter, authRouter);
app.use('/api/chats',      authWriteLimiter, chatsRouter);
app.use('/api/requests',   authWriteLimiter, requestsRouter);
app.use('/api/uploads',    authWriteLimiter, uploadsRouter);
app.use('/api/users',      authWriteLimiter, usersRouter);
app.use('/api/ratings',    authWriteLimiter, ratingsRouter); // #80
app.use('/api/businesses', businessesRouter);
app.use('/api/answers',    answersRouter);
// Admin sub-routers (Stream 4: #73 #74 #75 #76 #77). Each enforces
// authenticate + requireRole('admin') internally. Mount BEFORE the generic
// adminRouter so /api/admin/{volunteers,requests,users,stats} resolve to their
// dedicated routers; adminRouter keeps /api/admin/pending|approve|reject|etc.
app.use('/api/admin/volunteers', authWriteLimiter, adminVolunteersRouter);
app.use('/api/admin/requests',   authWriteLimiter, adminRequestsRouter);
app.use('/api/admin/users',      authWriteLimiter, adminUsersRouter);
app.use('/api/admin/stats',      authWriteLimiter, adminStatsRouter);
app.use('/api/admin',      authWriteLimiter, adminRouter);
app.use('/api/volunteers', authWriteLimiter, volunteersRouter);

// Catch-all 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[backend] CORS allowing origins: ${[...ALLOWED_ORIGINS].join(', ')} (+ localhost)`);
});
