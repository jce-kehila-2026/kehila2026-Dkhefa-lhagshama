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

import { initializeFirebaseAdmin } from '@/lib/firebaseAdmin';
import authRouter from '@/routes/auth';
import requestsRouter from '@/routes/requests';
import uploadsRouter from '@/routes/uploads';
import { authenticate } from '@/middleware/auth';

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

// Initialize Firebase Admin SDK before any route handler runs.
initializeFirebaseAdmin();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === FRONTEND_ORIGIN || LOCAL_ORIGIN_RE.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
}));
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
app.use('/api/auth',     authRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/uploads',  uploadsRouter);
//
// import answersRouter from '@/routes/answers';        // UC-02
// import businessesRouter from '@/routes/businesses';  // UC-03
// import chatsRouter from '@/routes/chats';            // UC-04
// import adminRouter from '@/routes/admin';            // UC-05
//
// app.use('/api/answers',    answersRouter);
// app.use('/api/businesses', businessesRouter);
// app.use('/api/chats',      chatsRouter);
// app.use('/api/admin',      adminRouter);

// Catch-all 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[backend] CORS allowing origin: ${FRONTEND_ORIGIN}`);
});
