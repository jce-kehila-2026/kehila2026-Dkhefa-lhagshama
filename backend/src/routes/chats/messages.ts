/**
 * POST /api/chats/:id/messages — Send a message. The caller must be a
 * participant in the chat. Inactive chats are read-only (409).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';

import { chatIsActive, REPLY_NOTIFY_THROTTLE_MS } from './helpers';

export async function sendMessage(req: Request, res: Response): Promise<void> {
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

  const chatData = chatSnap.data() as {
    participants: string[];
    requestId?: string | null;
    lastReplyNotifyAt?: string | null;
    active?: unknown;
  };
  if (!chatData.participants.includes(req.user.uid)) {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  // Inactive chat = read-only composer; the server enforces it too.
  if (!chatIsActive(chatData)) {
    res.status(409).json({ error: 'chat_inactive' });
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

  // ── Volunteer-reply notification (req 27) — fire-and-forget ──────────────
  // When a volunteer/admin replies in a chat linked to a request, email the
  // beneficiary. Throttled on chats/{id}.lastReplyNotifyAt (≤1 per 15 min) so a
  // burst of messages doesn't spam them. Notify failures never break the send.
  void (async () => {
    try {
      const isHandlerRole = req.user?.role === 'volunteer' || req.user?.role === 'admin';
      if (!isHandlerRole || !chatData.requestId) return;

      const last = chatData.lastReplyNotifyAt
        ? Date.parse(chatData.lastReplyNotifyAt)
        : NaN;
      const nowMs = Date.now();
      if (!Number.isNaN(last) && nowMs - last < REPLY_NOTIFY_THROTTLE_MS) return;

      await db()
        .collection('chats')
        .doc(chatId)
        .update({ lastReplyNotifyAt: new Date(nowMs).toISOString() });

      await notifyBeneficiaryOfRequest(chatData.requestId, 'reply');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[chats.messages] reply notify failed:', err);
    }
  })();

  res.status(201).json({ messageId: msgRef.id });
}
