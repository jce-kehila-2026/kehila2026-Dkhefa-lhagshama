/**
 * /api/chats — UC-04 Chat between beneficiary and assigned handler,
 * plus admin-created direct (staff/group) chats.
 *
 * All writes go through the Admin SDK (bypasses Firestore rules).
 * Clients read via onSnapshot with the rules in firestore.rules.
 *
 * Schema:
 *   chats/{chatId}     – participants[], requestId, kind, createdBy, title,
 *                        active, lastMessageAt, lastReplyNotifyAt (email throttle)
 *   messages/{msgId}   – chatId, senderId, content, timestamp, status; optional:
 *                        attachment { name, path, type, size } (req 26),
 *                        isSystem + targetUid + targetName (system messages —
 *                        targetName is denormalized at write time so removed
 *                        participants keep readable names)
 *
 * Tolerant reads: chat docs created before the direct-chat feature carry no
 * kind/createdBy/title/active — readers treat them as kind 'request' and
 * active true.
 *
 * This module was mechanically split into focused handler files; the router
 * below wires each handler to the same method+path+middleware order as the
 * original single-file route. The helper re-exports keep '@/routes/chats'
 * resolving for adminChats.ts.
 */
import express, { Router } from 'express';

import { authenticate, requireRole } from '@/middleware/auth';

import { openChat } from './openChat';
import { createDirectChat } from './directChat';
import { addParticipant, removeParticipant, listParticipants } from './participants';
import { sendMessage } from './messages';
import { uploadAttachment, getAttachmentUrl } from './attachments';

// Re-export shared helpers so existing '@/routes/chats' imports keep working.
export { chatKind, chatIsActive, postSystemMessage } from './helpers';

const router = Router();

// ── POST /api/chats ───────────────────────────────────────────────────────
router.post('/', authenticate, openChat);

// ── POST /api/chats/direct ────────────────────────────────────────────────
// admin-only: only staff may spin up direct (staff/group) chats outside a request.
router.post('/direct', authenticate, requireRole('admin'), createDirectChat);

// ── Participant management ────────────────────────────────────────────────
router.post('/:id/participants', authenticate, addParticipant);
router.delete('/:id/participants/:uid', authenticate, removeParticipant);

// ── POST /api/chats/:id/messages ─────────────────────────────────────────
router.post('/:id/messages', authenticate, sendMessage);

// ── GET /api/chats/:id/participants ──────────────────────────────────────────
router.get('/:id/participants', authenticate, listParticipants);

// ── POST /api/chats/:id/attachments ──────────────────────────────────────────
// raw body (any content-type, 12mb cap) so the handler streams bytes straight to
// Storage; must precede uploadAttachment so req.body is the file buffer, not JSON.
router.post(
  '/:id/attachments',
  authenticate,
  express.raw({ type: '*/*', limit: '12mb' }),
  uploadAttachment,
);

// ── GET /api/chats/:id/attachments/:name ─────────────────────────────────────
router.get('/:id/attachments/:name', authenticate, getAttachmentUrl);

export default router;
