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

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

// Initialize Firebase Admin SDK before any route handler runs.
initializeFirebaseAdmin();

const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check (unauthenticated). Used by deploy targets and by frontend
// startup to verify connectivity.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'push-for-fulfillment-backend' });
});

// Route mounts — uncomment as each vertical-slice UC lands.
//
// import requestsRouter from '@/routes/requests';      // UC-01
// import answersRouter from '@/routes/answers';        // UC-02
// import businessesRouter from '@/routes/businesses';  // UC-03
// import chatsRouter from '@/routes/chats';            // UC-04
// import adminRouter from '@/routes/admin';            // UC-05
//
// app.use('/api/requests',   requestsRouter);
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
