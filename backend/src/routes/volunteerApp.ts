/**
 * Volunteer operational app (reqs 14–19).
 *
 * Endpoints for the volunteer's own dashboard, insights, the available-request
 * pool, claiming, self status, and editing/dropping assigned requests. All
 * gated to role `volunteer` (admin is a superset). PII projection and
 * assignee-only checks are enforced here (volunteers use this API, not the
 * client Firestore SDK).
 *
 * NOTE: this is a stub mounted at /api/volunteer; the full implementation is
 * filled in by the volunteer-system workstream.
 */
import { Router } from 'express';

import { authenticate, requireAnyRole } from '@/middleware/auth';

const router = Router();

router.use(authenticate, requireAnyRole('volunteer'));

export default router;
