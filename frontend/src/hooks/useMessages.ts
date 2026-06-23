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
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { firebaseDb } from '../lib/firebase';
import type { ChatAttachment } from '../types';

const PAGE_SIZE = 50;

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date | null;
  status: string;
  /** Optional file attachment on the message (req 26); null for text-only. */
  attachment: ChatAttachment | null;
  /** True for server-posted system notes (senderId 'system'); rendered as a
   * centered note, not a bubble (feedback round 2). */
  isSystem: boolean;
  /** Uid the system note is about (participant added/removed), when any. */
  targetUid: string | null;
  /** Display name denormalized at write time, so the note stays readable
   * even after the named user leaves the participants list. */
  targetName: string | null;
}

interface UseMessagesResult {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

/** Raw shape of a `messages/{id}` document as stored by the backend. */
interface RawMessageDoc {
  chatId?: string;
  senderId?: string;
  content?: string;
  timestamp?: Timestamp | null;
  status?: string;
  attachment?: ChatAttachment | null;
  isSystem?: boolean;
  targetUid?: string;
  targetName?: string;
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

/**
 * Subscribe to one chat's messages live. Pass null chatId to detach (clears
 * messages, no listener). Re-subscribes whenever chatId changes; the effect
 * tears down the prior listener first so two chats never overlap. Returns
 * { messages, loading, error } where error is 'permission' | 'load_failed' | null.
 */
export function useMessages(chatId: string | null): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitN, setLimitN] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const unsubRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    setLimitN(PAGE_SIZE);
  }, [chatId]);

  useEffect(() => {
    // detach the prior chat's listener before (re)subscribing, so a chatId
    // switch can't leave a stale listener feeding the wrong messages.
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
      orderBy('timestamp', 'desc'),
      limit(limitN),
    );

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        setHasMore(snap.docs.length >= limitN);
        const msgs: ChatMessage[] = snap.docs.slice().reverse().map((doc) => {
          const d = doc.data() as RawMessageDoc;
          return {
            id: doc.id,
            chatId: d.chatId ?? '',
            senderId: d.senderId ?? '',
            content: d.content ?? '',
            timestamp: d.timestamp?.toDate() ?? null,
            status: d.status ?? 'sent',
            attachment: toAttachment(d.attachment),
            // treat sender 'system' as a system note even on older docs that
            // predate the explicit isSystem flag.
            isSystem: d.isSystem === true || d.senderId === 'system',
            targetUid: typeof d.targetUid === 'string' ? d.targetUid : null,
            targetName: typeof d.targetName === 'string' ? d.targetName : null,
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
  }, [chatId, limitN]);

  const loadMore = () => setLimitN((n) => n + PAGE_SIZE);

  return { messages, loading, error, hasMore, loadMore };
}
