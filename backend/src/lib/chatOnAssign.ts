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

    // Ensure volunteer is in participants
    if (!chatData.participants.includes(volunteerId)) {
      await chatsRef.doc(chatId).update({
        participants: [...chatData.participants, volunteerId],
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
