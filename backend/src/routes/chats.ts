/**
 * /api/chats — UC-04 Chat between beneficiary and assigned handler.
 *
 * All writes go through the Admin SDK (bypasses Firestore rules).
 * Clients read via onSnapshot with the rules in firestore.rules.
 *
 * Schema:
 *   chats/{chatId}     – participants[], requestId, lastMessageAt
 *   messages/{msgId}   – chatId, senderId, content, timestamp, status
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate } from '@/middleware/auth';

const router = Router();

// ── POST /api/chats ───────────────────────────────────────────────────────
// Open (or retrieve) a chat for a given requestId.
// Auto-creates the chat document if one doesn't exist yet.
// Only the request's beneficiaryId or handler (assignedTo) may open a chat.
router.post('/', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = z.object({
    requestId: z.string().min(1),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { requestId } = parsed.data;

  const requestSnap = await db().collection('requests').doc(requestId).get();
  if (!requestSnap.exists) {
    res.status(404).json({ error: 'request_not_found' });
    return;
  }

  const requestData = requestSnap.data() as {
    beneficiaryId: string;
    handler?: string | null;
  };

  const uid = req.user.uid;
  const isParticipant =
    uid === requestData.beneficiaryId || uid === requestData.handler;

  if (!isParticipant && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Check if a chat for this requestId already exists.
  const existing = await db()
    .collection('chats')
    .where('requestId', '==', requestId)
    .limit(1)
    .get();

  if (!existing.empty) {
    res.status(200).json({ chatId: existing.docs[0].id });
    return;
  }

  // Build participants list: beneficiary + handler (if set).
  const participants = [requestData.beneficiaryId];
  if (requestData.handler) participants.push(requestData.handler);

  const chatRef = db().collection('chats').doc();
  await chatRef.set({
    requestId,
    participants,
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ chatId: chatRef.id });
});

// ── POST /api/chats/:id/messages ─────────────────────────────────────────
// Send a message. The caller must be a participant in the chat.
router.post('/:id/messages', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;

  const parsed = z.object({
    content: z.string().trim().min(1).max(4000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const chatSnap = await db().collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    res.status(404).json({ error: 'chat_not_found' });
    return;
  }

  const chatData = chatSnap.data() as { participants: string[] };
  if (!chatData.participants.includes(req.user.uid)) {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  const msgRef = db().collection('messages').doc();
  const now = FieldValue.serverTimestamp();

  await msgRef.set({
    chatId,
    senderId: req.user.uid,
    content: parsed.data.content,
    timestamp: now,
    status: 'sent',
  });

  // Update lastMessageAt on the chat document.
  await db().collection('chats').doc(chatId).update({ lastMessageAt: now });

  res.status(201).json({ messageId: msgRef.id });
});

export default router;
