/**
 * Authentication middleware.
 *
 * Verifies the Firebase ID token sent in `Authorization: Bearer <token>`.
 * On success, attaches `req.user = { uid, email, role }` for downstream handlers.
 * On failure, returns 401.
 *
 * Custom claims:
 *   request.auth.token.role ∈ { beneficiary | businessOwner | volunteer | admin }
 *
 * Use the `requireRole(role)` helper to gate admin-only or role-specific endpoints.
 */
import type { NextFunction, Request, Response } from 'express';

import { auth as firebaseAuth } from '@/lib/firebaseAdmin';

export type Role = 'beneficiary' | 'businessOwner' | 'volunteer' | 'admin';

export interface AuthedUser {
  uid: string;
  email?: string;
  role?: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const idToken = header.slice('Bearer '.length).trim();

  try {
    const decoded = await firebaseAuth().verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: (decoded.role as Role | undefined) ?? undefined,
    };
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[auth] token verification failed:', err);
    res.status(401).json({ error: 'invalid_token' });
  }
}

export function requireRole(role: Role) {
  return function roleGuard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!req.user) {
      res.status(401).json({ error: 'not_authenticated' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ error: 'forbidden', required: role });
      return;
    }
    next();
  };
}
