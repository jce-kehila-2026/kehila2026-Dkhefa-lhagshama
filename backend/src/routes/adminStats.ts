/**
 * /api/admin/stats — Admin dashboard aggregate counts (#77).
 *
 * Returns lightweight counts for the admin dashboard stat cards. Uses
 * Firestore aggregate count() queries so we never page through documents.
 *
 *   GET /api/admin/stats
 *     {
 *       openRequests, inProgressRequests, awaitingReviewRequests,
 *       resolvedRequests, closedRequests, referredRequests, totalRequests,
 *       helped,                      // closed + referred (people we helped)
 *       activeVolunteers, pendingVolunteers, totalUsers,
 *       requestsWithClaims, unassignedRequests, pendingCategoryRequests,
 *       pendingDirectory,            // answers + businesses awaiting approval
 *       todayNewRequests             // created since local midnight
 *     }
 *
 * Status vocabulary mirrors REQUEST_STATUSES in lib/requestTransitions.ts:
 *   pending | in_progress | awaiting_review | closed | rejected | referred
 * (Note 6 — legacy `resolved` is retired; `helped` = closed + referred.)
 */
import { Router, type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { localMidnightUtc } from '@/lib/dashboardStats';
import { Timestamp } from 'firebase-admin/firestore';

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

/**
 * Count volunteers that have at least one `requestedCategories` entry awaiting
 * review (status === 'pending'). `requestedCategories` is an array of objects on
 * the volunteer doc, so we scan the (small) collection and filter in memory
 * rather than relying on a composite/array query.
 */
async function countPendingCategoryRequests(): Promise<number> {
  const snap = await db().collection('volunteers').get();
  let pending = 0;
  for (const doc of snap.docs) {
    const reqs = (doc.data() as { requestedCategories?: Array<{ status?: string }> })
      .requestedCategories;
    if (Array.isArray(reqs) && reqs.some((r) => r?.status === 'pending')) {
      pending += 1;
    }
  }
  return pending;
}

/**
 * Count requests that need a volunteer but have none assigned: active-status
 * requests (`pending` / `in_progress`) where `assignedVolunteerId` is null.
 * Firestore aggregate count() with an equality-on-null clause per status.
 */
async function countUnassignedRequests(): Promise<number> {
  const ACTIVE_STATUSES = ['pending', 'in_progress'] as const;
  const counts = await Promise.all(
    ACTIVE_STATUSES.map(async (status) => {
      const snap = await db()
        .collection('requests')
        .where('status', '==', status)
        .where('assignedVolunteerId', '==', null)
        .count()
        .get();
      return snap.data().count;
    }),
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Count requests created since local midnight today. Uses the pure
 * localMidnightUtc helper against the server clock + its timezone offset, then
 * a Firestore aggregate count() with createdAt >= that instant.
 */
async function countTodayNewRequests(): Promise<number> {
  const now = new Date();
  const midnight = localMidnightUtc(now, now.getTimezoneOffset());
  const snap = await db()
    .collection('requests')
    .where('createdAt', '>=', Timestamp.fromDate(midnight))
    .count()
    .get();
  return snap.data().count;
}

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      openRequests,
      inProgressRequests,
      awaitingReviewRequests,
      closedRequests,
      referredRequests,
      totalRequests,
      activeVolunteers,
      pendingVolunteers,
      totalUsers,
      requestsWithClaims,
      unassignedRequests,
      pendingCategoryRequests,
      pendingAnswers,
      pendingBusinesses,
      todayNewRequests,
    ] = await Promise.all([
      count('requests', 'status', '==', 'pending'),
      count('requests', 'status', '==', 'in_progress'),
      count('requests', 'status', '==', 'awaiting_review'),
      count('requests', 'status', '==', 'closed'),
      count('requests', 'status', '==', 'referred'),
      count('requests'),
      count('volunteers', 'active', '==', true),
      count('volunteerApplications', 'status', '==', 'pending'),
      count('users'),
      count('requests', 'hasClaims', '==', true),
      countUnassignedRequests(),
      countPendingCategoryRequests(),
      count('answers', 'status', '==', 'pending'),
      count('businesses', 'status', '==', 'pending'),
      countTodayNewRequests(),
    ]);

    // "Helped" = requests we brought to a positive close, plus those referred
    // to a partner (Note 6/8 — both count as helped).
    const helped = closedRequests + referredRequests;
    const pendingDirectory = pendingAnswers + pendingBusinesses;

    res.json({
      openRequests,
      inProgressRequests,
      awaitingReviewRequests,
      // `resolvedRequests` kept as a back-compat alias (= closed) so the
      // existing dashboard card key doesn't silently render 0.
      resolvedRequests: closedRequests,
      closedRequests,
      referredRequests,
      totalRequests,
      helped,
      activeVolunteers,
      pendingVolunteers,
      totalUsers,
      // Operational "needs attention" counts for the admin dashboard.
      requestsWithClaims,
      unassignedRequests,
      pendingCategoryRequests,
      pendingDirectory,
      todayNewRequests,
    });
  } catch (err) {
    console.error('[adminStats] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
