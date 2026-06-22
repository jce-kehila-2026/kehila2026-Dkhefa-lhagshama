/**
 * Participant management for /api/chats.
 *   POST   /api/chats/:id/participants        { uid }  — add a participant
 *   DELETE /api/chats/:id/participants/:uid             — remove a participant
 *   GET    /api/chats/:id/participants                  — participant identity
 *
 * The mutation guard/transaction lives in ./helpers (mutateParticipants +
 * participantSideEffects). See that file for the full guard semantics.
 */
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { resolveDisplayName } from '@/lib/displayName';
import { mintSignedReadUrl } from '@/lib/signedUrl';

import { findUnknownUids, mutateParticipants, participantSideEffects } from './helpers';

// POST /api/chats/:id/participants — add { uid } to a chat's participants.
// Validates the body uid, rejects uids unknown to the system, then delegates the
// authz/transaction to mutateParticipants. Responds { ok, added } (added=false
// when the uid was already a participant, i.e. no-op).
export async function addParticipant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = z.object({ uid: z.string().trim().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const chatId = req.params.id;
  const targetUid = parsed.data.uid;
  const actor = { uid: req.user.uid, isAdmin: req.user.role === 'admin' };

  try {
    // Don't grow participants with uids that don't exist anywhere.
    const unknown = await findUnknownUids([targetUid]);
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_participants', uids: unknown });
      return;
    }

    const outcome = await mutateParticipants(chatId, targetUid, actor, 'add');
    if (outcome.code !== 200) {
      res.status(outcome.code).json({ error: outcome.error });
      return;
    }
    if (outcome.changed) {
      await participantSideEffects(chatId, targetUid, actor, 'add');
    }
    res.status(200).json({ ok: true, added: outcome.changed === true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants.add] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}

// DELETE /api/chats/:id/participants/:uid — remove a participant.
// uid comes from the path (no body to validate); authz/transaction lives in
// mutateParticipants. Responds { ok, removed } (removed=false when the uid was
// not a participant, i.e. no-op).
export async function removeParticipant(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;
  const targetUid = req.params.uid;
  const actor = { uid: req.user.uid, isAdmin: req.user.role === 'admin' };

  try {
    const outcome = await mutateParticipants(chatId, targetUid, actor, 'remove');
    if (outcome.code !== 200) {
      res.status(outcome.code).json({ error: outcome.error });
      return;
    }
    if (outcome.changed) {
      await participantSideEffects(chatId, targetUid, actor, 'remove');
    }
    res.status(200).json({ ok: true, removed: outcome.changed === true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants.remove] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}

// GET /api/chats/:id/participants — participant identity for the chat UI
// (Note 11): photo + name for each participant, so the volunteer's face is
// visible to the beneficiary (trust). Participant-only, with an admin read
// bypass (oversight: admins may LOOK at any chat but must join as a participant
// before posting). Responds an array of { uid, displayName, avatarUrl } where
// avatarUrl is a short-lived signed URL minted from users/{uid}.photoURL, or
// null when the user has no photo.
export async function listParticipants(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;

  const chatSnap = await db().collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    res.status(404).json({ error: 'chat_not_found' });
    return;
  }

  const chatData = chatSnap.data() as { participants: string[] };
  // Participant guard with read-only admin bypass.
  if (!chatData.participants.includes(req.user.uid) && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  try {
    const participants = await Promise.all(
      (chatData.participants ?? []).map(async (uid) => {
        // Name falls through users → volunteers → Auth (e2e round 2, defect
        // D3: users mirror docs are mostly missing/empty, so rail + bubbles
        // degraded to uid fragments).
        const displayName = await resolveDisplayName(uid);
        const userSnap = await db().collection('users').doc(uid).get();
        const data = userSnap.exists ? userSnap.data() : undefined;
        const avatarUrl = await mintSignedReadUrl(
          typeof data?.photoURL === 'string' ? data.photoURL : null,
        );
        return { uid, displayName, avatarUrl };
      }),
    );
    res.status(200).json(participants);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
