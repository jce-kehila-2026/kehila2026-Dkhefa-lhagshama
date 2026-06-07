/**
 * useMessages — realtime Firestore listener for a chat's messages.
 *
 * Subscribes to the `messages` collection filtered by chatId, ordered by
 * timestamp ascending. Returns live-updated messages within ~1 s.
 * Cleans up the listener on unmount or when chatId changes.
 *
 * UC-04-b acceptance: two browser tabs as different participants exchange
 * messages live, new messages appear without refresh.
 */
import { useEffect, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { firebaseDb } from '../lib/firebase';
import type { ChatAttachment } from '../types';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date | null;
  status: string;
  /** Optional file attachment on the message (req 26); null for text-only. */
  attachment: ChatAttachment | null;
}

interface UseMessagesResult {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

/** Raw shape of a `messages/{id}` document as stored by the backend. */
interface RawMessageDoc {
  chatId?: string;
  senderId?: string;
  content?: string;
  timestamp?: Timestamp | null;
  status?: string;
  attachment?: ChatAttachment | null;
}

/** Normalize a raw `attachment` map into a ChatAttachment, or null if absent. */
function toAttachment(raw: ChatAttachment | null | undefined): ChatAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name !== 'string' || typeof raw.path !== 'string') return null;
  return {
    name: raw.name,
    path: raw.path,
    type: typeof raw.type === 'string' ? raw.type : 'application/octet-stream',
    size: typeof raw.size === 'number' ? raw.size : 0,
  };
}

export function useMessages(chatId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    // Clean up any previous listener.
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(firebaseDb, 'messages'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'asc'),
    );

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        const msgs: ChatMessage[] = snap.docs.map((doc) => {
          const d = doc.data() as RawMessageDoc;
          return {
            id: doc.id,
            chatId: d.chatId ?? '',
            senderId: d.senderId ?? '',
            content: d.content ?? '',
            timestamp: d.timestamp?.toDate() ?? null,
            status: d.status ?? 'sent',
            attachment: toAttachment(d.attachment),
          };
        });
        setMessages(msgs);
        setLoading(false);
      },
      (err) => {
        console.error('[useMessages] onSnapshot error:', err);
        const code = (err as { code?: string })?.code;
        setError(code === 'permission-denied' ? 'permission' : 'load_failed');
        setLoading(false);
      },
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [chatId]);

  return { messages, loading, error };
}
