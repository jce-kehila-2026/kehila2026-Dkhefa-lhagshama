/**
 * POST /api/chats/direct — create a direct (staff/group) chat that is NOT bound
 * to a request. Unlike request chats (auto-created on volunteer assignment), a
 * direct chat is an ad-hoc admin-to-staff/group thread (kind: 'direct',
 * requestId: null).
 *
 * Mounted in routes/chats/index.ts behind authenticate + requireRole('admin'),
 * so admin auth and req.user are guaranteed by the time this runs. The creator
 * is always a participant; every other uid is verified best-effort against
 * Firebase Auth / the users collection (findUnknownUids). On success it seeds a
 * 'chat_created' system message and writes an audit log. Collaborators:
 * ./helpers (uid check + system message), lib/audit, lib/firebaseAdmin.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';

import { findUnknownUids, postSystemMessage } from './helpers';

// Request body shape: 1-20 non-empty participant uids + an optional title.
export const directSchema = z.object({
  participantUids: z.array(z.string().trim().min(1).max(128)).min(1).max(20),
  title: z.string().trim().min(1).max(120).optional(),
  // Optional client-supplied id for idempotency (audit L1): a double-click or
  // network retry that re-POSTs with the SAME id reuses the existing chat
  // instead of creating a duplicate (+ duplicate system message + audit log).
  // Omitted -> a fresh server id (non-idempotent, the previous behavior).
  clientRequestId: z.string().trim().min(8).max(128).optional(),
});

/**
 * Express handler for POST /api/chats/direct. Validates the body, verifies the
 * named participants exist, creates the chat doc, and responds 201 with the
 * created chat ({ id, kind, title, participants, active }). Error shapes:
 * 400 validation / 400 unknown_participants / 500 internal.
 */
export async function createDirectChat(req: Request, res: Response): Promise<void> {
  const parsed = directSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const actor = req.user!.uid;
  // Dedupe and make sure the creator participates in their own chat.
  const participants = [...new Set([actor, ...parsed.data.participantUids])];
  // schema caps participantUids at 20, but adding the creator can push the
  // deduped total to 21, so re-check the hard cap here.
  if (participants.length > 20) {
    res.status(400).json({ error: 'validation', detail: 'max 20 participants' });
    return;
  }

  try {
    // verify only the named participants; the creator is trusted (already authed).
    const unknown = await findUnknownUids(participants.filter((uid) => uid !== actor));
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_participants', uids: unknown });
      return;
    }

    // Idempotency (audit L1): with a clientRequestId, use it as the doc id and
    // `.create()` (first-write-wins). A retry with the same id throws
    // ALREADY_EXISTS, which we treat as "reuse the existing chat" — no duplicate
    // chat, system message, or audit log. Without a key, fall back to a random
    // id + set() (previous behavior).
    const clientId = parsed.data.clientRequestId;
    const chatDoc = {
      requestId: null,
      participants,
      kind: 'direct',
      createdBy: actor,
      title: parsed.data.title ?? null,
      active: true,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    };

    let chatRef;
    if (clientId) {
      chatRef = db().collection('chats').doc(clientId);
      try {
        await chatRef.create(chatDoc);
      } catch (err) {
        if ((err as { code?: number }).code === 6 /* ALREADY_EXISTS */) {
          // Idempotent hit: the chat already exists — return it without
          // re-posting the system message / audit log.
          res.status(200).json({
            id: chatRef.id,
            kind: 'direct',
            title: parsed.data.title ?? null,
            participants,
            active: true,
          });
          return;
        }
        throw err;
      }
    } else {
      chatRef = db().collection('chats').doc();
      await chatRef.set(chatDoc);
    }

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
