/**
 * Chat-on-assign helper (#71).
 *
 * Keeps the per-request chat's `participants` array in sync with who actually
 * serves a request, since chat read/write/attachment access is gated purely on
 * `participants` membership. Used server-side (Admin SDK) by adminRequests.ts:
 * ensureChatForRequest after an assign/re-assign write succeeds,
 * removeVolunteerFromRequestChat when a volunteer drops the case.
 *
 * Invariant: exactly one chat per requestId; the beneficiary is never removed
 * from it, and a volunteer no longer on the case is never left in participants.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/lib/firebaseAdmin';

// args for ensureChatForRequest; identifies the request and the parties whose
// chat membership must be reconciled.
interface EnsureChatInput {
  requestId: string;
  beneficiaryId: string;
  volunteerId: string;
  /**
   * The volunteer previously assigned to this request, if any. On a re-assign
   * (prevVolunteerId !== volunteerId) the former volunteer must be removed from
   * the chat — chat read/write/attachment access is gated purely on
   * participants membership, so leaving them in keeps a volunteer who no longer
   * serves the case able to read the beneficiary's conversation + attachments.
   */
  prevVolunteerId?: string | null;
}

/**
 * Find or create a chat for the given request.
 * If a chat already exists, adds the volunteer to participants if not present
 * and posts a system message. Returns the chatId.
 */
export async function ensureChatForRequest({
  requestId,
  beneficiaryId,
  volunteerId,
  prevVolunteerId = null,
}: EnsureChatInput): Promise<string> {
  const chatsRef = db().collection('chats');

  // Find every chat tied to this request. We intentionally DON'T .limit(1):
  // a past create race (audit #6) can leave more than one chat for a request,
  // and an orphan we skip would keep granting a dropped/re-assigned volunteer
  // participants-based read access to the beneficiary's conversation. Reconciling
  // all matching chats closes that hole.
  const existing = await chatsRef
    .where('requestId', '==', requestId)
    .get();

  let chatId: string;

  if (!existing.empty) {
    // Return the first chat as the canonical one, but reconcile membership on
    // EVERY matching chat (not just docs[0]).
    chatId = existing.docs[0].id;

    // On a re-assign, drop the outgoing volunteer so they lose chat read/write/
    // attachment access to a case they no longer serve. Keep the beneficiary and
    // the incoming volunteer; never remove the beneficiary even on a mismatch.
    const removing =
      prevVolunteerId && prevVolunteerId !== volunteerId && prevVolunteerId !== beneficiaryId
        ? prevVolunteerId
        : null;

    // ATOMICITY FIX (audit MODERATE #1): use field-atomic arrayRemove/arrayUnion
    // instead of reading the array and overwriting the whole thing. The whole-
    // array overwrite could clobber a concurrent admin add-participant
    // (FieldValue.arrayUnion via mutateParticipants) that landed between our read
    // and write — a last-write-wins loss of a security-relevant membership entry.
    // arrayUnion/arrayRemove are idempotent, so no change-detection is needed.
    await Promise.all(
      existing.docs.map(async (chatDoc) => {
        // arrayRemove + arrayUnion can't target the same field in ONE update, so
        // the re-assign case does two atomic writes (remove old, then add new).
        if (removing) {
          await chatDoc.ref.update({ participants: FieldValue.arrayRemove(removing) });
        }
        await chatDoc.ref.update({
          participants: FieldValue.arrayUnion(volunteerId),
          lastMessageAt: FieldValue.serverTimestamp(),
        });
      }),
    );
  } else {
    // Create the chat with a DETERMINISTIC id = requestId via `.create()`
    // (audit MODERATE #2): first-write-wins, so this can't race openChat (or a
    // retried assign) into two chats for one request. The where-query above
    // already reused any legacy random-id chat, so we only reach here when none
    // exists yet.
    const chatRef = chatsRef.doc(requestId);
    chatId = requestId;
    try {
      await chatRef.create({
        requestId,
        participants: [beneficiaryId, volunteerId],
        kind: 'request',
        createdBy: 'system',
        title: null,
        active: true,
        lastMessageAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // ALREADY_EXISTS (6): a concurrent creator (e.g. openChat) won the race —
      // just ensure the incoming volunteer is a participant on the winner's chat.
      if ((err as { code?: number }).code === 6) {
        await chatRef.update({
          participants: FieldValue.arrayUnion(volunteerId),
          lastMessageAt: FieldValue.serverTimestamp(),
        });
      } else {
        throw err;
      }
    }
  }

  // Post a system message to notify about the assignment
  const msgRef = db().collection('messages').doc();
  await msgRef.set({
    chatId,
    senderId: 'system',
    content: `[SYSTEM] A volunteer has been assigned to your request.`,
    timestamp: FieldValue.serverTimestamp(),
    status: 'sent',
    isSystem: true,
  });

  // bump lastMessageAt so the system message surfaces the chat in list ordering
  await chatsRef.doc(chatId).update({
    lastMessageAt: FieldValue.serverTimestamp(),
  });

  return chatId;
}

/**
 * Remove a volunteer from a request's chat (e.g. when the volunteer self-drops
 * the case). Chat read/write/attachment access is gated purely on participants
 * membership, so a dropped volunteer who stays in `participants` keeps full
 * access to the beneficiary's conversation + attachments — strip them. The
 * beneficiary is never removed. Best-effort: a missing chat is a no-op.
 */
export async function removeVolunteerFromRequestChat(
  requestId: string,
  volunteerId: string,
): Promise<void> {
  const chatsRef = db().collection('chats');
  // Reconcile EVERY chat for the request (no .limit(1)): a duplicate/orphan chat
  // would otherwise keep the dropped volunteer in its participants and leave them
  // read access (audit #1/#6). arrayRemove is atomic + idempotent.
  //
  // RESILIENCE (audit MODERATE #3): chat access is gated on participants
  // membership, so if this removal fails ENTIRELY on a transient error the
  // dropped volunteer keeps read access until the next lifecycle action. Retry a
  // few times to narrow that window; on persistent failure we rethrow so the
  // caller logs it (a periodic reconciliation job is the full durability fix).
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const existing = await chatsRef.where('requestId', '==', requestId).get();
      if (existing.empty) return;
      await Promise.all(
        existing.docs.map((chatDoc) => {
          const chatData = chatDoc.data() as { participants?: string[] };
          if (!Array.isArray(chatData.participants) || !chatData.participants.includes(volunteerId)) {
            return Promise.resolve();
          }
          return chatDoc.ref.update({
            participants: FieldValue.arrayRemove(volunteerId),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }),
      );
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastErr;
}
