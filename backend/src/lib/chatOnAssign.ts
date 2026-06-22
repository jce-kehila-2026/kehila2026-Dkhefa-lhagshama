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

  // Check if a chat already exists for this request
  const existing = await chatsRef
    .where('requestId', '==', requestId)
    .limit(1)
    .get();

  let chatId: string;

  if (!existing.empty) {
    const chatDoc = existing.docs[0];
    chatId = chatDoc.id;
    const chatData = chatDoc.data() as { participants: string[] };

    // On a re-assign, drop the outgoing volunteer so they lose chat read/write/
    // attachment access to a case they no longer serve. Keep the beneficiary and
    // the incoming volunteer; never remove the beneficiary even on a mismatch.
    const removing =
      prevVolunteerId && prevVolunteerId !== volunteerId && prevVolunteerId !== beneficiaryId
        ? prevVolunteerId
        : null;

    const next = new Set(chatData.participants);
    if (removing) next.delete(removing);
    const wasMember = chatData.participants.includes(volunteerId);
    next.add(volunteerId);

    // only write when membership actually changed (incoming volunteer was new,
    // or an outgoing one is being dropped) to avoid a redundant update
    if (removing || !wasMember) {
      await chatsRef.doc(chatId).update({
        participants: Array.from(next),
        lastMessageAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    // Create new chat with both participants
    const chatRef = chatsRef.doc();
    chatId = chatRef.id;
    await chatRef.set({
      requestId,
      participants: [beneficiaryId, volunteerId],
      kind: 'request',
      createdBy: 'system',
      title: null,
      active: true,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
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
  const existing = await chatsRef.where('requestId', '==', requestId).limit(1).get();
  if (existing.empty) return;

  const chatDoc = existing.docs[0];
  const chatData = chatDoc.data() as { participants?: string[] };
  if (!Array.isArray(chatData.participants) || !chatData.participants.includes(volunteerId)) {
    return;
  }

  await chatsRef.doc(chatDoc.id).update({
    participants: FieldValue.arrayRemove(volunteerId),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
