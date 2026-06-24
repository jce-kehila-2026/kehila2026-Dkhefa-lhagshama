/**
 * Centralized error-handling safety net for the Express backend (audit CRITICAL).
 *
 * BIG PICTURE
 * -----------
 * Express 4 does NOT automatically catch a rejected promise returned from an
 * `async` route handler. If a handler `await`s something that rejects (a
 * transient Firestore error, a missing index, a quota hit) and has no local
 * `try/catch`, the promise rejects silently: no response is ever sent (the
 * client hangs until timeout) and Node emits an `unhandledRejection` — which on
 * Node 22 (our runtime) terminates the process by default.
 *
 * Every handler in this codebase wraps its own body in `try/catch` EXCEPT one
 * (`openChat`), which made crash-safety "one forgotten try away" from a hung
 * request. This module replaces that fragility with three layers:
 *
 *   1. `asyncHandler(fn)` — wrap any async handler so a rejection is forwarded
 *      to Express's error pipeline via `next(err)` instead of vanishing. Use it
 *      on new routes so a missing local try/catch can never hang a request.
 *   2. `errorHandler` — the single 4-argument Express error middleware. It is
 *      mounted LAST in app.ts and turns any forwarded/thrown error into a clean
 *      `500 { error: 'internal_error' }`, logging the full error server-side
 *      but NEVER leaking a stack trace to the client.
 *   3. `installProcessSafetyNets()` — last-resort `unhandledRejection` /
 *      `uncaughtException` listeners so a stray async error anywhere logs loudly
 *      instead of silently killing the process.
 *
 * Together these mean: a single un-try/caught async failure becomes a logged,
 * clean 500 — not a hung connection or a dead instance.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async Express handler so any rejected promise is routed to `next(err)`
 * (and from there to {@link errorHandler}). Express 4 only auto-catches
 * SYNCHRONOUS throws; this bridges the async gap.
 *
 *   router.post('/', authenticate, asyncHandler(openChat));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return function wrapped(req, res, next) {
    // Promise.resolve(...) normalizes both async fns and accidental sync throws;
    // .catch(next) hands any rejection to the central error middleware.
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Central Express error middleware (must be registered LAST, after the routes
 * and the 404 catch-all). Express recognizes it as an error handler by its
 * 4-argument signature.
 *
 * Contract: log the real error for the operators, return a generic 500 to the
 * client. We deliberately do NOT echo `err.message`/stack — that can leak
 * internal paths, Firestore field names, or SDK internals to an attacker.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If headers were already sent (the handler partially responded then threw),
  // we cannot send another response — delegate to Express's default handler,
  // which will close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[errorHandler] unhandled route error:', err);
  res.status(500).json({ error: 'internal_error' });
}

/**
 * Register process-level last-resort listeners. Called once from each
 * entrypoint (index.ts for local dev, function.ts for Cloud Functions).
 *
 * `unhandledRejection`: without a listener, Node 22 prints a warning and
 * terminates the process on the next tick. We log it loudly and keep the
 * process alive so one stray rejection cannot take down a whole instance
 * mid-demo. (The right long-term fix is to wrap the offending handler in
 * `asyncHandler`; this is the backstop.)
 *
 * `uncaughtException`: log loudly. We intentionally do NOT force-exit here — on
 * Cloud Functions the platform manages instance lifecycle, and during a live
 * demo availability beats a hard crash. With `asyncHandler` + `errorHandler` in
 * place, a genuinely uncaught synchronous throw should be vanishingly rare.
 */
export function installProcessSafetyNets(): void {
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('[process] unhandledRejection (kept alive — wrap the handler in asyncHandler):', reason);
  });
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('[process] uncaughtException:', err);
  });
}
