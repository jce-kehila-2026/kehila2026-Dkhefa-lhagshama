/**
 * /api/requests — UC-01 Submit Assistance Request.
 *
 * All writes go through the Admin SDK (which bypasses Firestore rules).
 * The client never writes to /requests directly — rules `allow create: if false`.
 *
 * Roles allowed to submit:
 *   - beneficiary: submitting for themselves
 *   - volunteer:   submitting on behalf of a beneficiary (UC-01 alt flow A2);
 *                  the volunteer's uid is recorded as the actor; `onBehalfOf`
 *                  holds the target beneficiary uid if known.
 *
 * Admin can read everything via UC-05; rules + GET /api/requests/:id enforce.
 *
 * This module composes the Router from focused handler modules (mechanical
 * split of the former single-file router). Route order + per-route
 * `authenticate` middleware are preserved exactly — in particular
 * /:id/attachments/:name and /:id/events are registered BEFORE /:id so the
 * literal segments win over the param.
 */
import { Router } from 'express';

import { authenticate } from '@/middleware/auth';
import { REQUEST_STATUSES, type RequestStatus } from '@/lib/requestTransitions';

import { createRequest } from './create';
import { listMine } from './mine';
import { markDone } from './done';
import { closeRequest } from './close';
import { viewAttachment } from './attachments';
import { listEvents } from './events';
import { getRequest } from './getOne';

// ── Status lifecycle (Note 6) ───────────────────────────────────────────────
// The canonical status enum + transition map now live in
// `@/lib/requestTransitions`. Re-exported here for the many existing importers
// (adminRequests, adminStats) so nothing breaks while they migrate.
export { REQUEST_STATUSES };
export type { RequestStatus };

const router = Router();

router.post('/', authenticate, createRequest);
router.get('/mine', authenticate, listMine);
router.post('/:id/done', authenticate, markDone);
router.post('/:id/close', authenticate, closeRequest);
router.get('/:id/attachments/:name', authenticate, viewAttachment);
router.get('/:id/events', authenticate, listEvents);
router.get('/:id', authenticate, getRequest);

export default router;
