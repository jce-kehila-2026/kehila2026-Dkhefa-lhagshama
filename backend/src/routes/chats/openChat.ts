/**
 * openChat — express handler backing POST /api/chats.
 *
 * idempotent "open or create" for the per-request chat thread: given a requestId,
 * return the existing chat for that request, or create one on first open. one chat
 * per request is the core invariant (lookup is keyed on requestId).
 *
 * authorization: only people tied to the request (beneficiary, handler, assigned
 * volunteer) or an admin may open it. participants on the created chat doc mirror
 * that set, so firestore rules and the matching ui both see who is allowed in.
 * collaborates with the requests collection (source of truth for membership) and
 * the chats collection (this handler is the only writer that bootstraps a thread).
 *
 * Crash-safety: unlike its sibling handlers this function has no local try/catch;
 * it is mounted via `asyncHandler(openChat)` (see chats/index.ts), so any rejected
 * Firestore await is forwarded to the central errorHandler and returned as a clean
 * 500 rather than hanging the request or crashing the instance (audit CRITICAL C1).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';

export async function openChat(req: Request, res: Response): Promise<void> {
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
    assignedVolunteerId?: string | null;
  };

  // membership is derived from the request, not the chat (the chat may not exist yet).
  // admins bypass the participant check.
  const uid = req.user.uid;
  const isParticipant =
    uid === requestData.beneficiaryId ||
    uid === requestData.handler ||
    uid === requestData.assignedVolunteerId;

  if (!isParticipant && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // idempotency: reuse the existing thread if one was already opened for this request.
  // 200 (reused) vs 201 (created below) lets callers distinguish the two.
  const existing = await db()
    .collection('chats')
    .where('requestId', '==', requestId)
    .limit(1)
    .get();

  if (!existing.empty) {
    res.status(200).json({ chatId: existing.docs[0].id });
    return;
  }

  // Build participants list: beneficiary + handler + assigned volunteer (if set).
  // F7: previously omitted assignedVolunteerId, which under-granted an assigned
  // volunteer access to the chat they're meant to take part in.
  const participants = [requestData.beneficiaryId];
  if (requestData.handler) participants.push(requestData.handler);
  if (
    requestData.assignedVolunteerId &&
    requestData.assignedVolunteerId !== requestData.handler
  ) {
    participants.push(requestData.assignedVolunteerId);
  }

  const chatRef = db().collection('chats').doc();
  await chatRef.set({
    requestId,
    participants,
    kind: 'request',
    createdBy: uid,
    title: null,
    active: true,
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ chatId: chatRef.id });
}
