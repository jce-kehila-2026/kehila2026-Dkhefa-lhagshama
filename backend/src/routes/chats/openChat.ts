/**
 * POST /api/chats — Open (or retrieve) a chat for a given requestId.
 * Auto-creates the chat document if one doesn't exist yet.
 * Only the request's beneficiaryId or handler (assignedTo) may open a chat.
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

  const uid = req.user.uid;
  const isParticipant =
    uid === requestData.beneficiaryId ||
    uid === requestData.handler ||
    uid === requestData.assignedVolunteerId;

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
