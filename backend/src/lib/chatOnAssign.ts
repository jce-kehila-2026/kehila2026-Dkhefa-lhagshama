/**
 * Chat-on-assign helper (#71).
 *
 * When an admin assigns a volunteer to a request, this function
 * ensures a chat document exists between the beneficiary and the volunteer,
 * and posts a system message confirming the assignment.
 *
 * This is server-only (Admin SDK). It is called from adminRequests.ts
 * after the assignment write succeeds.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '@/lib/firebaseAdmin';

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

  // Update lastMessageAt
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
