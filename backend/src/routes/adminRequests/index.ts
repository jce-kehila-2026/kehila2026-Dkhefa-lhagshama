/**
 * /api/admin/requests — Admin-only request management endpoints (#75).
 *
 * Endpoints (registered in this exact order):
 *   GET  /api/admin/requests                — list + filter all requests
 *   GET  /api/admin/requests/:id/candidates — ranked volunteer matching (WS-6)
 *   GET  /api/admin/requests/:id            — single request detail
 *   POST /api/admin/requests/:id/assign     — assign a volunteer
 *   POST /api/admin/requests/:id/status     — change status
 *   POST /api/admin/requests/:id/refer      — refer to a partner
 *   POST /api/admin/requests/:id/archive    — archive a closed/referred request
 *   POST /api/admin/requests/:id/note       — add internal note
 *   POST /api/admin/requests/task           — create a volunteer task request (req 20/21)
 *
 * All writes: Admin SDK (bypasses Firestore rules).
 * Every mutating action emits a requestEvent + writeAuditLog.
 * The assign endpoint also triggers chat-on-assign (#71) via chats module.
 *
 * This module composes the Router from focused handler modules (mechanical
 * split of the former single-file router). Route order is preserved exactly —
 * in particular /:id/candidates is registered BEFORE /:id so the literal path
 * wins over the param, and /task stays after the /:id/* routes.
 */
import { Router } from 'express';

import { authenticate, requireRole } from '@/middleware/auth';

import { listRequests } from './list';
import { listCandidates } from './candidates';
import { getRequestDetail } from './detail';
import { assignVolunteer } from './assign';
import { changeStatus } from './status';
import { referRequest } from './refer';
import { archiveRequest } from './archive';
import { addNote } from './note';
import { createTask } from './task';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', listRequests);
router.get('/:id/candidates', listCandidates);
router.get('/:id', getRequestDetail);
router.post('/:id/assign', assignVolunteer);
router.post('/:id/status', changeStatus);
router.post('/:id/refer', referRequest);
router.post('/:id/archive', archiveRequest);
router.post('/:id/note', addNote);
router.post('/task', createTask);

export default router;
