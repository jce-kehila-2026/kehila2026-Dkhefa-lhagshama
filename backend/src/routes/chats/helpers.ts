/**
 * Shared helpers + schemas for the /api/chats route group.
 *
 * These were extracted verbatim from the original src/routes/chats.ts during a
 * mechanical split; behavior is unchanged. `chatKind`, `chatIsActive`, and
 * `postSystemMessage` are re-exported from src/routes/chats/index.ts so that
 * '@/routes/chats' (used by adminChats.ts) keeps resolving them.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { auth, db } from '@/lib/firebaseAdmin';
import { resolveDisplayName } from '@/lib/displayName';
import { writeAuditLog } from '@/lib/audit';

/** Tolerant chat-kind read: docs missing `kind` are request chats. */
export function chatKind(data: { kind?: unknown }): 'request' | 'direct' {
  return data.kind === 'direct' ? 'direct' : 'request';
}

/** Tolerant active read: docs missing `active` count as live. */
export function chatIsActive(data: { active?: unknown }): boolean {
  return data.active !== false;
}

/**
 * Post a system message into a chat, following the chat-on-assign convention:
 * senderId 'system', isSystem true, content prefixed '[SYSTEM] '. The content
 * carries a machine-readable marker (e.g. 'chat_paused') so the frontend can
 * render translated copy; `targetUid` optionally names the affected user.
 */
export async function postSystemMessage(
  chatId: string,
  marker: string,
  targetUid?: string,
): Promise<void> {
  // Denormalize the affected user's name at write time so the note stays
  // readable after the user leaves the participants list (e2e round 2,
  // defect D3: "X was removed" showed a uid fragment once X was gone).
  const targetName = targetUid ? await resolveDisplayName(targetUid) : null;
  const msgRef = db().collection('messages').doc();
  await msgRef.set({
    chatId,
    senderId: 'system',
    content: `[SYSTEM] ${marker}`,
    ...(targetUid ? { targetUid } : {}),
    ...(targetName ? { targetName } : {}),
    timestamp: FieldValue.serverTimestamp(),
    status: 'sent',
    isSystem: true,
  });
  await db().collection('chats').doc(chatId).update({
    lastMessageAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Best-effort existence check for a batch of uids: Firebase Auth first
 * (batched getUsers), then the `users` collection for any leftovers. Returns
 * the uids that could not be confirmed. If BOTH lookups fail outright
 * (infra error), returns [] — verification is best-effort and must not block.
 */
export async function findUnknownUids(uids: string[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const missing = new Set(uids);
  let anyLookupWorked = false;

  try {
    const result = await auth().getUsers(uids.map((uid) => ({ uid })));
    for (const u of result.users) missing.delete(u.uid);
    anyLookupWorked = true;
  } catch {
    /* fall through to the users collection */
  }

  if (missing.size > 0) {
    try {
      const refs = [...missing].map((uid) => db().collection('users').doc(uid));
      const snaps = await db().getAll(...refs);
      for (const s of snaps) if (s.exists) missing.delete(s.id);
      anyLookupWorked = true;
    } catch {
      /* best-effort */
    }
  }

  return anyLookupWorked ? [...missing] : [];
}

// ── Chat attachment hardening — mirrors uploads.ts (#84) ───────────────────
/** Allowed MIME types for chat attachments (PDF / JPEG / PNG / DOCX). */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

/** Maximum individual file size: 10 MB. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Throttle window for the volunteer-reply notification (req 27). */
export const REPLY_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

// ── Participant management shared transaction logic ────────────────────────
// Guard: actor is admin OR (direct chat && actor is its creator). On request
// chats the linked request's beneficiary and current assigned volunteer are
// protected from removal (409). Add of an existing participant (and remove of
// a non-participant) is a no-op 200. The membership write runs in a
// transaction together with the guard reads.

export interface ParticipantTxOutcome {
  code: 200 | 403 | 404 | 409;
  error?: string;
  changed?: boolean;
}

/** Shared transaction body for add/remove. */
export async function mutateParticipants(
  chatId: string,
  targetUid: string,
  actor: { uid: string; isAdmin: boolean },
  op: 'add' | 'remove',
): Promise<ParticipantTxOutcome> {
  const chatRef = db().collection('chats').doc(chatId);

  return db().runTransaction<ParticipantTxOutcome>(async (tx) => {
    const snap = await tx.get(chatRef);
    if (!snap.exists) return { code: 404, error: 'chat_not_found' };

    const chat = snap.data() as {
      kind?: unknown;
      createdBy?: unknown;
      requestId?: string | null;
      participants?: string[];
    };
    const kind = chatKind(chat);

    const isCreator = kind === 'direct' && chat.createdBy === actor.uid;
    if (!actor.isAdmin && !isCreator) {
      return { code: 403, error: 'forbidden' };
    }

    if (op === 'remove' && kind === 'request' && chat.requestId) {
      // Protect the request's core pair: beneficiary + current volunteer.
      const reqSnap = await tx.get(db().collection('requests').doc(chat.requestId));
      if (reqSnap.exists) {
        const rd = reqSnap.data() as {
          beneficiaryId?: string | null;
          assignedVolunteerId?: string | null;
        };
        if (targetUid === rd.beneficiaryId || targetUid === rd.assignedVolunteerId) {
          return { code: 409, error: 'protected_participant' };
        }
      }
    }

    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    const isMember = participants.includes(targetUid);
    if (op === 'add' ? isMember : !isMember) {
      return { code: 200, changed: false };
    }

    tx.update(chatRef, {
      participants:
        op === 'add' ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { code: 200, changed: true };
  });
}

/** Shared post-transaction bookkeeping: system message + admin audit log. */
export async function participantSideEffects(
  chatId: string,
  targetUid: string,
  actor: { uid: string; isAdmin: boolean },
  op: 'add' | 'remove',
): Promise<void> {
  try {
    await postSystemMessage(
      chatId,
      op === 'add' ? 'participant_added' : 'participant_removed',
      targetUid,
    );
    if (actor.isAdmin) {
      await writeAuditLog({
        actorId: actor.uid,
        action: op === 'add' ? 'chat.participant_add' : 'chat.participant_remove',
        entityType: 'chats',
        entityId: chatId,
        details: { uid: targetUid },
      });
    }
  } catch (err) {
    // The membership write committed; bookkeeping is best-effort.
    // eslint-disable-next-line no-console
    console.warn('[chats.participants] side effects failed:', err);
  }
}
