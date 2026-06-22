/**
 * POST /api/chats/direct — Admin-only: create a direct (staff/group) chat that
 * is NOT bound to a request. The creator is always included in participants;
 * every other uid must exist in Firebase Auth or the users collection
 * (best-effort check).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';

import { findUnknownUids, postSystemMessage } from './helpers';

export const directSchema = z.object({
  participantUids: z.array(z.string().trim().min(1).max(128)).min(1).max(20),
  title: z.string().trim().min(1).max(120).optional(),
});

export async function createDirectChat(req: Request, res: Response): Promise<void> {
  const parsed = directSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const actor = req.user!.uid;
  // Dedupe and make sure the creator participates in their own chat.
  const participants = [...new Set([actor, ...parsed.data.participantUids])];
  if (participants.length > 20) {
    res.status(400).json({ error: 'validation', detail: 'max 20 participants' });
    return;
  }

  try {
    const unknown = await findUnknownUids(participants.filter((uid) => uid !== actor));
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_participants', uids: unknown });
      return;
    }

    const chatRef = db().collection('chats').doc();
    await chatRef.set({
      requestId: null,
      participants,
      kind: 'direct',
      createdBy: actor,
      title: parsed.data.title ?? null,
      active: true,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await postSystemMessage(chatRef.id, 'chat_created');

    await writeAuditLog({
      actorId: actor,
      action: 'chat.direct_create',
      entityType: 'chats',
      entityId: chatRef.id,
      details: { participants, title: parsed.data.title ?? null },
    });

    res.status(201).json({
      id: chatRef.id,
      kind: 'direct',
      title: parsed.data.title ?? null,
      participants,
      active: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.direct] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
