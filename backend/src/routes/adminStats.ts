/**
 * /api/admin/stats — Admin dashboard aggregate counts (#77).
 *
 * Returns lightweight counts for the admin dashboard stat cards. Uses
 * Firestore aggregate count() queries so we never page through documents.
 *
 *   GET /api/admin/stats
 *     {
 *       openRequests, inProgressRequests, resolvedRequests, totalRequests,
 *       helped,                      // alias of resolvedRequests (UI label)
 *       activeVolunteers, pendingVolunteers,
 *       totalUsers
 *     }
 *
 * Status vocabulary mirrors REQUEST_STATUSES in routes/requests.ts:
 *   pending | in_progress | resolved | rejected | closed
 */
import { Router, type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

type WhereOp = FirebaseFirestore.WhereFilterOp;

async function count(
  collection: string,
  field?: string,
  op?: WhereOp,
  value?: unknown,
): Promise<number> {
  let query: FirebaseFirestore.Query = db().collection(collection);
  if (field && op) {
    query = query.where(field, op, value as never);
  }
  const snap = await query.count().get();
  return snap.data().count;
}

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      openRequests,
      inProgressRequests,
      resolvedRequests,
      totalRequests,
      activeVolunteers,
      pendingVolunteers,
      totalUsers,
    ] = await Promise.all([
      count('requests', 'status', '==', 'pending'),
      count('requests', 'status', '==', 'in_progress'),
      count('requests', 'status', '==', 'resolved'),
      count('requests'),
      count('volunteers', 'active', '==', true),
      count('volunteerApplications', 'status', '==', 'pending'),
      count('users'),
    ]);

    res.json({
      openRequests,
      inProgressRequests,
      resolvedRequests,
      totalRequests,
      helped: resolvedRequests,
      activeVolunteers,
      pendingVolunteers,
      totalUsers,
    });
  } catch (err) {
    console.error('[adminStats] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
