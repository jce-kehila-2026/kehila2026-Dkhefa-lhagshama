/**
 * requireVerifiedEmail middleware (#86).
 *
 * Must be composed AFTER `authenticate` so `req.user` is populated.
 * Re-verifies the token with `checkRevoked: false` (fast path — token
 * was already verified by `authenticate`). We decode the raw token a
 * second time because `authenticate` only stores uid/email/role on
 * `req.user`, not `email_verified`.
 *
 * Usage:
 *   router.post('/some-route', authenticate, requireVerifiedEmail, handler)
 */
import type { NextFunction, Request, Response } from 'express';

import { auth as firebaseAuth } from '@/lib/firebaseAdmin';

export async function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const idToken = header.slice('Bearer '.length).trim();

  try {
    const decoded = await firebaseAuth().verifyIdToken(idToken);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'email_not_verified' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
