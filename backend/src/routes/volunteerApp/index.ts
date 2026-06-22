/**
 * Volunteer operational app (reqs 14–19).
 *
 * Endpoints for the volunteer's own dashboard, insights, the available-request
 * pool, claiming, self status, and editing/dropping assigned requests. All
 * gated to role `volunteer` (admin is a superset). PII projection and
 * assignee-only checks are enforced here (volunteers use this API, not the
 * client Firestore SDK).
 *
 * Mounted at /api/volunteer; the router-level guard below lets volunteers AND
 * admins through (admin is a superset). `uid = req.user.uid` throughout.
 *
 * Firestore access pattern: single-field `where` equality queries, then sort /
 * aggregate in memory so no composite index is ever required (matches the
 * convention in adminRequests / requests).
 *
 * This module composes the Router from focused handler modules (mechanical
 * split of the former single-file router). Route order + the router-level
 * `authenticate, requireAnyRole('volunteer')` guard are preserved exactly.
 *
 * Endpoints (registered in this exact order):
 *   GET   /api/volunteer/me
 *   PATCH /api/volunteer/me
 *   GET   /api/volunteer/assigned
 *   GET   /api/volunteer/pool
 *   POST  /api/volunteer/pool/:id/claim
 *   PATCH /api/volunteer/requests/:id
 *   POST  /api/volunteer/requests/:id/drop
 *   POST  /api/volunteer/requests/:id/close
 *   GET   /api/volunteer/insights
 */
import { Router } from 'express';

import { authenticate, requireAnyRole } from '@/middleware/auth';

import { getMe, patchMe } from './me';
import { getAssigned } from './assigned';
import { getPool, claimPoolRequest } from './pool';
import { editRequest, dropRequest, closeRequest } from './requests';
import { getInsights } from './insights';

const router = Router();

router.use(authenticate, requireAnyRole('volunteer'));

router.get('/me', getMe);
router.patch('/me', patchMe);
router.get('/assigned', getAssigned);
router.get('/pool', getPool);
router.post('/pool/:id/claim', claimPoolRequest);
router.patch('/requests/:id', editRequest);
router.post('/requests/:id/drop', dropRequest);
router.post('/requests/:id/close', closeRequest);
router.get('/insights', getInsights);

export default router;
