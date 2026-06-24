/**
 * Local / standalone entrypoint for the Push for Fulfillment backend.
 *
 * The Express app itself lives in `src/app.ts` (no port binding). This file is
 * the dev/standalone runner: it imports the configured app and binds a port.
 * The Cloud Functions deploy uses `src/function.ts` instead, which wraps the
 * same app in an HTTPS function (no listen()).
 */
import { app, ALLOWED_ORIGINS } from '@/app';
import { installProcessSafetyNets } from '@/middleware/errorHandler';

// Last-resort process listeners: a stray unhandledRejection/uncaughtException is
// logged loudly instead of silently killing the dev server (audit CRITICAL).
installProcessSafetyNets();

// dev port; 3001 is the local default the frontend points NEXT_PUBLIC_API_BASE_URL at.
// note: Cloud Functions reserves PORT, which is why deploys go through function.ts, not here.
const PORT = Number(process.env.PORT ?? 3001);

// bind the configured app and log the effective CORS allowlist so dev can see which
// origins are accepted (localhost is always permitted in addition to ALLOWED_ORIGINS).
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[backend] CORS allowing origins: ${[...ALLOWED_ORIGINS].join(', ')} (+ localhost)`);
});
