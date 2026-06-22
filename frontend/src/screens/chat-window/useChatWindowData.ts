import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { firebaseDb } from "@/lib/firebase";
import { apiFetch } from "@/lib/apiClient";
import { projectLinkedRequest } from "./shared";
import type { ChatParticipant, ChatMeta, LinkedRequest } from "./shared";

/**
 * Data layer for the chat window: the live chat-doc projection (kind / title /
 * active / membership), the participant identity map, and the linked-request
 * projection (status + assigned handler + close handshake). Owned by the page;
 * behavior is identical to the inline effects it replaces.
 */
export function useChatWindowData(listenChatId: string | null) {
  // ── Live chat-doc projection (kind / title / active / membership) ──────
  // onSnapshot (not a one-shot read) so an admin pause, a participant change
  // or a request end state flips the UI live. Admins can read any chat doc
  // (rules carve-out); a removed participant just stops receiving updates.
  const [chatMeta, setChatMeta] = useState<ChatMeta | null>(null);

  // Note 6 — the linked request (status + assigned handler) powers the
  // volunteer's "Mark as done" control + the close-consent strip. The chat-doc
  // listener mirrors `requestId` here; the fetch effect below re-runs only
  // when the id value actually changes.
  const [linkedRequest, setLinkedRequest] = useState<LinkedRequest | null>(null);
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!listenChatId) {
      setChatMeta(null);
      setLinkedRequestId(null);
      return;
    }
    const unsub = onSnapshot(
      doc(firebaseDb, "chats", listenChatId),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        // Derive a stable activity tick from lastMessageAt (Timestamp | string).
        // Every close-consent action (propose/approve/decline/close) posts a
        // chat system message, which bumps lastMessageAt, so this tick changes
        // whenever a close handshake advances on the other side — driving the
        // linkedRequest refetch that updates the strip/status pill/buttons live.
        const lma = d.lastMessageAt as { toMillis?: () => number } | string | undefined;
        const activityTick =
          lma && typeof lma === "object" && typeof lma.toMillis === "function"
            ? lma.toMillis()
            : typeof lma === "string"
              ? Date.parse(lma) || 0
              : 0;
        setChatMeta({
          kind: d.kind === "direct" ? "direct" : "request",
          title: typeof d.title === "string" && d.title.trim() ? d.title : null,
          active: d.active !== false,
          createdBy: typeof d.createdBy === "string" ? d.createdBy : null,
          participantUids: Array.isArray(d.participants)
            ? d.participants.filter((p): p is string => typeof p === "string")
            : [],
          activityTick,
        });
        setLinkedRequestId(
          typeof d.requestId === "string" && d.requestId ? d.requestId : null,
        );
      },
      () => {
        // Permission/network error — the message feed surfaces its own state.
        setChatMeta(null);
      },
    );
    return unsub;
  }, [listenChatId]);

  // ── Note 11 — participant identity (photo + name) ──────────────────────
  // Fetch the chat's participants (authenticated; participant-only with an
  // admin read bypass). Build a senderId → { displayName, avatarUrl } map used
  // to render a real name + photo per sender; initials fallback when no photo.
  // Re-runs when membership changes (join / add / remove via the live doc).
  const [participants, setParticipants] = useState<Record<string, ChatParticipant>>({});
  const participantsKey = chatMeta ? chatMeta.participantUids.join(",") : "";

  useEffect(() => {
    if (!listenChatId) {
      setParticipants({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/chats/${listenChatId}/participants`);
        if (!res.ok) return; // 403/other — keep the title-only fallback
        const list = (await res.json()) as ChatParticipant[];
        if (cancelled || !Array.isArray(list)) return;
        const map: Record<string, ChatParticipant> = {};
        for (const p of list) {
          if (p && typeof p.uid === "string") map[p.uid] = p;
        }
        setParticipants(map);
      } catch {
        // Network error — leave the map empty; UI degrades to the title.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listenChatId, participantsKey]);

  // Refetch the linked request and update the strip. Used after a close-consent
  // action so the handshake state (closeRequest / status) reflects the server.
  async function refetchLinkedRequest() {
    if (!linkedRequestId) return;
    try {
      const res = await apiFetch(`/api/requests/${linkedRequestId}`);
      if (!res.ok) return;
      const data = (await res.json()) as Partial<LinkedRequest> & { id?: string };
      const next = projectLinkedRequest(data);
      if (next) setLinkedRequest(next);
    } catch {
      // Leave the last-known state in place; the user can retry.
    }
  }

  // The chat-doc listener mirrors requestId into linkedRequestId; this effect
  // re-runs only when the id value actually changes (the chat doc itself
  // updates on every message via lastMessageAt, but setState with an
  // identical string bails out).
  useEffect(() => {
    if (!linkedRequestId) {
      setLinkedRequest(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/requests/${linkedRequestId}`);
        if (!res.ok) return; // 403/other — silently skip the lifecycle control
        const data = (await res.json()) as Partial<LinkedRequest> & { id?: string };
        if (cancelled) return;
        const next = projectLinkedRequest(data);
        if (next) setLinkedRequest(next);
      } catch {
        // Network/permission error — leave the control hidden; chat still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedRequestId]);

  // Keep the close-consent strip in sync with server state (review r6, finding
  // 20). `linkedRequest` is otherwise only re-fetched on id change or after THIS
  // user's own close action — so when the OTHER party proposes/declines/approves,
  // the strip (driven by linkedRequest.closeRequest / status) would go stale
  // until a reload. Every close-consent action now posts a chat system message
  // (propose/approve/decline/close), which bumps chats.lastMessageAt and thus
  // advances chatMeta.activityTick; re-fetch on that tick so the handshake
  // reflects the server without the user having to act. Skip the very first
  // tick (the id-change effect above already fetched).
  const chatActivityTick = chatMeta?.activityTick ?? 0;
  const lastSyncedTick = useRef<number | null>(null);
  useEffect(() => {
    if (!linkedRequestId) {
      lastSyncedTick.current = null;
      return;
    }
    if (lastSyncedTick.current === null) {
      // First observation for this request — the id-change fetch covers it.
      lastSyncedTick.current = chatActivityTick;
      return;
    }
    if (chatActivityTick === lastSyncedTick.current) return;
    lastSyncedTick.current = chatActivityTick;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/requests/${linkedRequestId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Partial<LinkedRequest> & { id?: string };
        if (cancelled) return;
        const next = projectLinkedRequest(data);
        if (next) setLinkedRequest(next);
      } catch {
        // Leave the last-known state in place; the user can still act.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatActivityTick, linkedRequestId]);

  return {
    chatMeta,
    participants,
    linkedRequest,
    setLinkedRequest,
    linkedRequestId,
    refetchLinkedRequest,
  };
}
