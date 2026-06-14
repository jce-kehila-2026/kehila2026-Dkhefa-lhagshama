import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  MessageCircle,
  MessagesSquare,
  AlertCircle,
  ShieldOff,
  Send,
  CheckCircle2,
  Loader2,
  FileText,
  Paperclip,
  Download,
  XCircle,
  Clock,
  UserPlus,
  X,
  Eye,
} from "lucide-react";

import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { firebaseDb } from "../lib/firebase";
import { apiFetch } from "../lib/apiClient";
import { formatRequestRef } from "@/lib/requestRef";
import { useMessages } from "../hooks/useMessages";
import type { ChatMessage } from "../hooks/useMessages";
import { getIdToken } from "../lib/auth";
import Reveal from "../components/motion/Reveal";
import ConfirmDialog from "../components/feedback/ConfirmDialog";
import UserPickerDialog from "../components/chat/UserPickerDialog";
import type { RequestStatus, CloseRequest, ChatKind } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/** Client-side attachment guard (req 26): PDF / JPEG / PNG / DOCX, <= 10MB. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
/** Extension fallback for browsers that report an empty/odd MIME type. */
const ALLOWED_ATTACHMENT_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".docx"];

/** Human-readable file size (matches the request-form attachment style). */
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A chat participant as returned by GET /api/chats/:id/participants. */
interface ChatParticipant {
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Live projection of the chat document (feedback round 2): kind/title/active
 * drive group semantics and the read-only composer; createdBy + participants
 * drive participant management and the admin "join to write" state. Tolerant
 * reads — legacy docs count as live request chats.
 */
interface ChatMeta {
  kind: ChatKind;
  title: string | null;
  active: boolean;
  createdBy: string | null;
  participantUids: string[];
  /** Chat-activity tick (lastMessageAt millis): a stable primitive that changes
   *  on every new message / system message. Used to re-fetch the linked request
   *  so the close-consent strip reflects the other party's decline/approve. */
  activityTick: number;
}

/**
 * Note 6 — minimal projection of the request linked to this chat, used only to
 * drive the volunteer's "Mark as done" control. The chat document carries a
 * `requestId`; we read the request once (lightweight) to learn its status and
 * who is handling it. Status/lifecycle writes stay server-only.
 */
interface LinkedRequest {
  id: string;
  /** Friendly reference "REQ-####" (WS-3); display-only. */
  displayId?: string | null;
  status: RequestStatus;
  handler?: string | null;
  assignedVolunteerId?: string | null;
  /** Owner uid — used to tell whether the current user is the beneficiary. */
  beneficiaryId?: string | null;
  /** Mutual-consent close handshake (req 25); null when none is in flight. */
  closeRequest?: CloseRequest | null;
}

/**
 * Initials for the identity avatar — first glyphs of up to two words,
 * falling back to the leading character of the label. Mirrors the pattern
 * used in the admin user/volunteer rosters so avatars look consistent.
 */
function toInitials(label: string | undefined | null): string {
  const s = String(label ?? "").trim();
  if (!s) return "?";
  const parts = s.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default function ChatWindowPage() {
  const { t, lang, isRTL } = useLanguage();
  const { user, loading: authLoading, hasRole } = useAuth();
  const { toast } = useApp();
  const c = t.chat;
  const lc = t.lifecycle;
  const router = useRouter();
  const { id: chatId } = router.query;

  // Only attach the listener once auth is resolved AND a user exists,
  // so logged-out visitors never trigger a permission-denied snapshot.
  const listenChatId = !authLoading && user && typeof chatId === "string" ? chatId : null;
  const { messages, loading: msgsLoading, error: msgsError } = useMessages(listenChatId);

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
  const [markingDone, setMarkingDone] = useState(false);
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

  // Map a GET /api/requests/:id payload onto our minimal LinkedRequest.
  function projectLinkedRequest(
    data: Partial<LinkedRequest> & { id?: string },
  ): LinkedRequest | null {
    if (typeof data?.id !== "string" || typeof data.status !== "string") return null;
    return {
      id: data.id,
      status: data.status,
      handler: data.handler ?? null,
      assignedVolunteerId: data.assignedVolunteerId ?? null,
      beneficiaryId: data.beneficiaryId ?? null,
      closeRequest: data.closeRequest ?? null,
    };
  }

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

  // Guard: show "Mark as done" only when the signed-in user is the request's
  // assigned volunteer/handler (admin is a superset of volunteer via hasRole)
  // and the request is currently `in_progress`. Lifecycle writes are
  // server-only; this only gates the control's visibility.
  const isAssignedHandler =
    !!linkedRequest &&
    !!user &&
    (linkedRequest.assignedVolunteerId === user.uid || linkedRequest.handler === user.uid);
  const canMarkDone =
    !!linkedRequest &&
    hasRole("volunteer") &&
    isAssignedHandler &&
    linkedRequest.status === "in_progress";

  async function handleMarkDone() {
    if (!linkedRequest || markingDone || !canMarkDone) return;
    if (typeof window !== "undefined" && !window.confirm(lc.actions.markDoneConfirm)) return;

    const prevStatus = linkedRequest.status;
    setMarkingDone(true);
    // Optimistic: reflect the new `awaiting_review` status immediately, which
    // also hides the button (canMarkDone requires `in_progress`).
    setLinkedRequest((r) => (r ? { ...r, status: "awaiting_review" } : r));

    try {
      const res = await apiFetch(`/api/requests/${linkedRequest.id}/done`, {
        method: "POST",
      });
      if (!res.ok) {
        setLinkedRequest((r) => (r ? { ...r, status: prevStatus } : r));
        toast(lc.actions.markDoneError, "error");
        return;
      }
      const updated = (await res.json().catch(() => null)) as Partial<LinkedRequest> | null;
      if (updated && typeof updated.status === "string") {
        setLinkedRequest((r) => (r ? { ...r, status: updated.status as RequestStatus } : r));
      }
      toast(lc.actions.markDoneSuccess, "success");
    } catch {
      setLinkedRequest((r) => (r ? { ...r, status: prevStatus } : r));
      toast(lc.actions.markDoneError, "error");
    } finally {
      setMarkingDone(false);
    }
  }

  // ── req 25 — mutual-consent close handshake ────────────────────────────
  // The caller's role is derived from the request: if the signed-in user owns
  // the request (beneficiaryId), they act as the beneficiary and hit the
  // beneficiary endpoint; the assigned volunteer/handler (which may be an
  // admin) acts as the volunteer side. This mirrors the server's CloseRole
  // split.
  const isBeneficiary =
    !!linkedRequest && !!user && linkedRequest.beneficiaryId === user.uid;
  const myCloseRole: "beneficiary" | "volunteer" = isBeneficiary
    ? "beneficiary"
    : "volunteer";
  // Only the beneficiary or the assigned handler may use the control. A
  // non-assigned admin is excluded on purpose: the backend's ownership check
  // 403s them, so showing the buttons would only produce error toasts.
  const canUseCloseConsent =
    !!linkedRequest &&
    !!user &&
    (isBeneficiary || isAssignedHandler) &&
    (linkedRequest.status === "in_progress" ||
      linkedRequest.status === "awaiting_review");

  const closeReq = linkedRequest?.closeRequest ?? null;
  // WS-3 — friendly reference for the rail. Prefer the fetched linkedRequest's
  // displayId; fall back to a short slice of the UUID id we already mirror.
  const railRequestRef = formatRequestRef({
    displayId: linkedRequest?.displayId ?? null,
    id: linkedRequestId,
  });
  // Did THIS side already propose / approve? (proposedRole is the initiator.)
  const iProposed =
    !!closeReq &&
    (myCloseRole === "beneficiary"
      ? closeReq.beneficiaryApproved === true
      : closeReq.volunteerApproved === true);
  // The other side initiated and is waiting on me to confirm.
  const otherProposed = !!closeReq && !iProposed;

  const [closeBusy, setCloseBusy] = useState(false);

  async function handleCloseAction(action: "propose" | "approve" | "decline") {
    if (!linkedRequest || closeBusy || !canUseCloseConsent) return;
    setCloseBusy(true);
    try {
      const endpoint =
        myCloseRole === "beneficiary"
          ? `/api/requests/${linkedRequest.id}/close`
          : `/api/volunteer/requests/${linkedRequest.id}/close`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast(c.closeRequestError, "error");
        return;
      }
      // Always refetch so the strip reflects the authoritative server state
      // (closeRequest handshake fields and/or the new `closed` status).
      await refetchLinkedRequest();
    } catch {
      toast(c.closeRequestError, "error");
    } finally {
      setCloseBusy(false);
    }
  }

  // ── Membership / group semantics (feedback round 2) ────────────────────
  // membershipKnown gates the staff-view UI so participants never see a
  // "join" flash while the chat doc resolves.
  const membershipKnown = chatMeta !== null;
  const isMember =
    !!user && !!chatMeta && chatMeta.participantUids.includes(user.uid);
  // Admin viewing a chat they're not in: rules allow reading; the composer is
  // replaced by a "join to write" control.
  const isStaffViewer = membershipKnown && !isMember && hasRole("admin");

  const participantCount =
    chatMeta?.participantUids.length ?? Object.keys(participants).length;
  const isGroup = chatMeta?.kind === "direct" || participantCount >= 3;

  // Participant management: any admin manages any chat; the creator manages
  // their own direct chats. (Backend enforces the same guard.)
  const canManageParticipants =
    !!user &&
    (hasRole("admin") ||
      (chatMeta?.kind === "direct" && chatMeta.createdBy === user.uid));

  // The "other" participant (the one who isn't the signed-in user) — used to
  // headline two-person conversations with a human name + face.
  const otherParticipant =
    Object.values(participants).find((p) => p.uid !== user?.uid) ?? null;
  const otherName =
    (otherParticipant?.displayName && otherParticipant.displayName.trim()) ||
    c.participantFallback;

  // Headline for group/direct chats: title, else the other participants'
  // names, else the generic fallback.
  const groupName =
    chatMeta?.title ||
    Object.values(participants)
      .filter((p) => p.uid !== user?.uid)
      .map((p) => (p.displayName && p.displayName.trim()) || p.uid.slice(0, 6))
      .join(", ") ||
    (chatMeta?.kind === "direct" ? c.directChatFallback : c.titleFallback);

  // req 25 — who asked to close, attributed from closeRequest.proposedBy
  // (NOT "the first other participant", which misnames the proposer in
  // 3+-person chats). Falls back to the proposer's role, then a generic label.
  const closeProposer = closeReq?.proposedBy
    ? participants[closeReq.proposedBy]
    : undefined;
  const closeProposerName =
    (closeProposer?.displayName && closeProposer.displayName.trim()) ||
    (closeReq
      ? closeReq.proposedRole === "beneficiary"
        ? c.proposerBeneficiary
        : c.proposerVolunteer
      : c.otherPartyFallback);

  // ── Participant management + admin join (feedback round 2) ─────────────
  const [joinBusy, setJoinBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ChatParticipant | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  // Admin self-join: POST own uid; the live chat-doc listener flips
  // membership (and re-fetches the participant map) once the write lands.
  async function handleJoin() {
    if (!user || typeof chatId !== "string" || joinBusy) return;
    setJoinBusy(true);
    try {
      const res = await apiFetch(`/api/chats/${chatId}/participants`, {
        method: "POST",
        body: JSON.stringify({ uid: user.uid }),
      });
      if (!res.ok) toast(c.joinError, "error");
    } catch {
      toast(c.joinError, "error");
    } finally {
      setJoinBusy(false);
    }
  }

  // Add the picked users one by one (the endpoint takes a single uid).
  async function handleAddPeople(uids: string[]) {
    if (typeof chatId !== "string" || addBusy) return;
    setAddBusy(true);
    setAddError(null);
    try {
      for (const uid of uids) {
        const res = await apiFetch(`/api/chats/${chatId}/participants`, {
          method: "POST",
          body: JSON.stringify({ uid }),
        });
        if (!res.ok) {
          setAddError(c.addPersonError);
          return;
        }
      }
      setAddOpen(false);
    } catch {
      setAddError(c.addPersonError);
    } finally {
      setAddBusy(false);
    }
  }

  // Remove a participant (confirmed via dialog). A 409 means the backend is
  // protecting the request's beneficiary / assigned volunteer.
  async function handleRemoveParticipant() {
    if (!removeTarget || typeof chatId !== "string" || removeBusy) return;
    setRemoveBusy(true);
    try {
      const res = await apiFetch(
        `/api/chats/${chatId}/participants/${encodeURIComponent(removeTarget.uid)}`,
        { method: "DELETE" },
      );
      if (res.status === 409) {
        toast(c.protectedParticipant, "error");
      } else if (!res.ok) {
        toast(c.removePersonError, "error");
      }
      setRemoveTarget(null);
    } catch {
      toast(c.removePersonError, "error");
    } finally {
      setRemoveBusy(false);
    }
  }

  // ── Read-only composer states ───────────────────────────────────────────
  // A paused chat (admin toggle / request end state) and an ended linked
  // request both lock the composer; the server enforces this too (409).
  const chatPaused = !!chatMeta && !chatMeta.active;
  const requestEnded =
    !!linkedRequest &&
    (linkedRequest.status === "closed" ||
      linkedRequest.status === "rejected" ||
      linkedRequest.status === "referred");
  const composerLocked = chatPaused || requestEnded;

  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);

  // ── req 26 — file attachments ──────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  // Attachment names currently being fetched a signed URL for (per-bubble busy).
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const isRtl = lang === "he";
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  // Keep the message FEED pinned to its latest message — scroll only the feed
  // container, never the page (scrollIntoView would scroll every ancestor incl.
  // the window, yanking the whole page down when a chat opens). Jump instantly
  // on first paint and under reduced motion; glide only for live arrivals.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior =
      !didInitialScrollRef.current || prefersReduced ? "auto" : "smooth";
    didInitialScrollRef.current = true;
    feed.scrollTo({ top: feed.scrollHeight, behavior });
  }, [messages]);

  async function handleSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError("");

    try {
      const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSendError(body.error ?? "send_failed");
        return;
      }

      setInputText("");
    } catch {
      setSendError("send_failed");
    } finally {
      setSending(false);
    }
  }

  // req 26 — validate then raw-upload a picked file. The realtime listener
  // renders the resulting attachment message; no optimistic insert needed.
  async function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    // Reset the input so picking the same file again re-fires onChange.
    e.target.value = "";
    if (!file || uploading || typeof chatId !== "string") return;

    const lowerName = file.name.toLowerCase();
    const typeOk =
      ALLOWED_ATTACHMENT_TYPES.has(file.type) ||
      ALLOWED_ATTACHMENT_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!typeOk) {
      toast(c.badFileType, "error");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast(c.fileTooLarge, "error");
      return;
    }

    setUploading(true);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        toast(c.uploadFailed, "error");
        return;
      }
      const url = `${API_BASE}/api/chats/${encodeURIComponent(
        chatId,
      )}/attachments?filename=${encodeURIComponent(file.name)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!res.ok) {
        toast(c.uploadFailed, "error");
        return;
      }
    } catch {
      toast(c.uploadFailed, "error");
    } finally {
      setUploading(false);
    }
  }

  // req 26 — open an attachment: mint a short-lived signed URL, then open it
  // in a new tab. Works for both mine and incoming messages.
  async function handleDownload(att: NonNullable<ChatMessage["attachment"]>) {
    if (typeof chatId !== "string" || downloading[att.name]) return;
    setDownloading((d) => ({ ...d, [att.name]: true }));
    // Open the tab synchronously, inside the click's transient activation:
    // Safari (and strict popup settings) block window.open after an await.
    // Detach it from this page, then point it at the signed URL once minted;
    // close it again on any failure so no blank tab is left behind.
    const win = window.open("", "_blank");
    if (win) win.opener = null;
    try {
      const res = await apiFetch(
        `/api/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(att.name)}`,
      );
      if (!res.ok) {
        win?.close();
        toast(c.downloadFailed, "error");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data?.url) {
        win?.close();
        toast(c.downloadFailed, "error");
        return;
      }
      if (win) {
        win.location.replace(data.url);
      } else {
        // Popup denied even synchronously — best-effort fallback.
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      win?.close();
      toast(c.downloadFailed, "error");
    } finally {
      setDownloading((d) => {
        const next = { ...d };
        delete next[att.name];
        return next;
      });
    }
  }

  function formatTime(date: Date | null) {
    if (!date) return "";
    return date.toLocaleTimeString(isRtl ? "he-IL" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── Note 11 — avatar: photo when available, initials circle otherwise ──
  function renderAvatar(name: string, avatarUrl: string | null, size: "sm" | "md" | "lg") {
    const px = size === "sm" ? 28 : size === "lg" ? 52 : 40;
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={c.avatarAlt(name)}
          width={px}
          height={px}
          className={`chat-avatar chat-avatar--${size}`}
        />
      );
    }
    return (
      <span
        className={`chat-avatar chat-avatar--initials chat-avatar--${size}`}
        role="img"
        aria-label={c.avatarAlt(name)}
      >
        {toInitials(name)}
      </span>
    );
  }

  // Server system notes carry '[SYSTEM] <marker>' content. Map the known
  // machine-readable markers to localized copy (naming the affected user when
  // we can resolve them); unknown content renders as-is, prefix stripped.
  function systemMessageText(msg: ChatMessage): string {
    const raw = msg.content.startsWith("[SYSTEM]")
      ? msg.content.slice("[SYSTEM]".length).trim()
      : msg.content.trim();
    // Prefer the name denormalized onto the message at write time (survives
    // the user leaving the chat), then the live participants map, then a uid
    // fragment as the last resort.
    const targetName =
      msg.targetName?.trim() ||
      (msg.targetUid
        ? participants[msg.targetUid]?.displayName?.trim() ||
          msg.targetUid.slice(0, 6)
        : null);
    switch (raw) {
      case "chat_created":
        return c.system.chatCreated;
      case "participant_added":
        return c.system.participantAdded(targetName ?? c.participantFallback);
      case "participant_removed":
        return c.system.participantRemoved(targetName ?? c.participantFallback);
      case "chat_paused":
        return c.system.chatPaused;
      case "chat_resumed":
        return c.system.chatResumed;
      case "close_proposed":
        return c.system.closeProposed;
      case "close_approved":
        return c.system.closeApproved;
      case "close_declined":
        return c.system.closeDeclined;
      case "close_closed":
        return c.system.closeClosed;
      default:
        // Legacy assignment note posted by chat-on-assign.
        if (raw.startsWith("A volunteer has been assigned"))
          return c.system.volunteerAssigned;
        return raw;
    }
  }

  // ── Shared centred-state shell (loading / empty / error / permission) ──
  // Reuses the cross-screen `.chat-state` vocabulary; here it sits centred
  // inside the scrolling message feed.
  interface FeedStateProps {
    icon: ReactNode;
    tone?: "ember" | "danger" | "muted";
    title?: ReactNode;
    body?: ReactNode;
  }
  function renderFeedState({ icon, tone = "ember", title: stateTitle, body }: FeedStateProps) {
    const isError = tone === "danger";
    return (
      <div
        className="chat-state chat-state--feed"
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
      >
        <span aria-hidden="true" className={`chat-state__icon chat-state__icon--${tone}`}>
          {icon}
        </span>
        {stateTitle && <p className="chat-state__title">{stateTitle}</p>}
        {body && <p className="chat-state__body">{body}</p>}
      </div>
    );
  }

  // Auth gate: don't render the chat UI for logged-out users.
  if (!authLoading && !user) {
    return (
      <div className="page-container chat-window-shell" style={{ maxWidth: "560px" }}>
        <Reveal>
          <div className="chat-state chat-state--card">
            <span aria-hidden="true" className="chat-state__icon chat-state__icon--ember">
              <Lock size={26} />
            </span>
            <h1 className="chat-state__title">{c.signInRequired}</h1>
            <p className="chat-state__body">{c.signInWindowBody}</p>
            <div className="chat-state__action">
              <Link href={`/login?next=${encodeURIComponent(router.asPath)}`} className="btn btn-ember">
                {c.signIn}
                <ArrowRight size={16} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // Status-driven dot color for the rail. Maps only the canonical
  // RequestStatus set (types/index.ts): terminal states (closed/rejected/
  // referred) → done, active work (in_progress/awaiting_review) → active, and
  // pending (or anything unknown) → open. The retired 'resolved'/'done'
  // strings are intentionally not handled — they are not part of the contract.
  const statusDotClass = (() => {
    const s = linkedRequest?.status;
    if (s === "closed" || s === "rejected" || s === "referred") return "chat-status__dot--done";
    if (s === "in_progress" || s === "awaiting_review") return "chat-status__dot--active";
    return "chat-status__dot--open";
  })();

  // Role-aware destination for the "Open request" link (see usage below). The
  // beneficiary's request lives on /my-requests; staff/volunteer never see it
  // there, so route them to a surface that does.
  const openRequestHref = (() => {
    const id = linkedRequest?.id ?? "";
    if (linkedRequest && user && linkedRequest.beneficiaryId === user.uid) {
      return `/my-requests?focus=${encodeURIComponent(id)}`;
    }
    if (hasRole("admin")) return `/admin/requests/${encodeURIComponent(id)}`;
    // Assigned volunteer / handler — their work surface is the assigned board.
    return "/volunteer-hub/assigned";
  })();

  return (
    <div className="page-container chat-window-shell">
      {/* ── Slim top bar: back to list + open linked request ── */}
      <div className="chat-window-bar">
        <Link href="/chats" className="btn btn-outline btn-sm">
          <BackArrow size={16} />
          {c.allActiveChats}
        </Link>
        {linkedRequest && (
          <div className="chat-window-bar__actions">
            {/* req 9 — bidirectional link back to the request. Role-aware: the
                beneficiary owns the request on /my-requests, but the assigned
                volunteer and an admin never see it there (GET /requests/mine is
                beneficiary-scoped), so route them to the surface that actually
                shows the request — admin detail for admins, the volunteer hub
                assigned board for the assigned volunteer/handler. */}
            <Link
              href={openRequestHref}
              className="btn btn-ghost btn-sm"
              aria-label={c.openRequest}
              title={c.openRequest}
            >
              <FileText size={16} aria-hidden="true" />
              {c.openRequest}
            </Link>
          </div>
        )}
      </div>

      <div className="chat-window-layout">
        {/* ── Conversation (wide column): scrolling feed + composer ── */}
        <div className="chat-window-main">
          <Reveal>
            <div className="card chat-conv">
              {/* Message feed — live region so screen readers announce
                  incoming messages; focusable so it can be scrolled by keyboard. */}
              <div
                ref={feedRef}
                className="chat-feed"
                role="log"
                aria-live="polite"
                aria-label={c.inlineHeader.eyebrow}
                tabIndex={0}
              >
                {msgsLoading &&
                  renderFeedState({
                    tone: "ember",
                    icon: <MessagesSquare size={26} />,
                    body: c.loadingMessages,
                  })}
                {msgsError === "permission" &&
                  renderFeedState({
                    tone: "muted",
                    icon: <ShieldOff size={26} />,
                    title: c.noAccess,
                  })}
                {msgsError &&
                  msgsError !== "permission" &&
                  renderFeedState({
                    tone: "danger",
                    icon: <AlertCircle size={26} />,
                    title: c.messagesError,
                  })}
                {!msgsLoading &&
                  !msgsError &&
                  messages.length === 0 &&
                  renderFeedState({
                    tone: "ember",
                    icon: <MessagesSquare size={26} />,
                    body: c.noMessages,
                  })}

                {messages.map((msg) => {
                  // System notes render as a centered muted line, not a bubble.
                  if (msg.isSystem) {
                    return (
                      <div key={msg.id} className="chat-sysmsg">
                        {systemMessageText(msg)}
                      </div>
                    );
                  }
                  const isMine = msg.senderId === user?.uid;
                  // Incoming rows show the sender's avatar (photo or initials),
                  // keyed by senderId, so the beneficiary sees the volunteer's
                  // face next to their words.
                  const sender = participants[msg.senderId];
                  const senderName =
                    (sender?.displayName && sender.displayName.trim()) ||
                    c.participantFallback;
                  return (
                    <div
                      key={msg.id}
                      className="chat-msg-row"
                      style={{
                        flexDirection: isMine ? "row-reverse" : "row",
                        justifyContent: isMine ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isMine && (
                        <span className="chat-msg-row__avatar">
                          {renderAvatar(senderName, sender?.avatarUrl ?? null, "sm")}
                        </span>
                      )}
                      <div className={`chat-msg-col${isMine ? " chat-msg-col--mine" : ""}`}>
                        {/* Group chats: name the sender above incoming bubbles
                            so two avatar-less senders stay distinguishable. */}
                        {!isMine && isGroup && (
                          <span className="chat-sender-name">{senderName}</span>
                        )}
                        {msg.attachment ? (
                          // req 26 — downloadable file bubble (mine + incoming).
                          <button
                            type="button"
                            className={`chat-file-bubble${
                              isMine ? " chat-file-bubble--mine" : ""
                            }`}
                            onClick={() => handleDownload(msg.attachment!)}
                            disabled={!!downloading[msg.attachment.name]}
                            aria-busy={!!downloading[msg.attachment.name]}
                            aria-label={`${c.download} - ${msg.attachment.name}`}
                            title={msg.attachment.name}
                            style={{ direction: isRtl ? "rtl" : "ltr" }}
                          >
                            <span className="chat-file-bubble__icon" aria-hidden="true">
                              <FileText size={18} />
                            </span>
                            <span className="chat-file-bubble__meta">
                              <span className="chat-file-bubble__name">
                                {msg.attachment.name}
                              </span>
                              <span className="chat-file-bubble__sub">
                                {formatBytes(msg.attachment.size)}
                              </span>
                            </span>
                            <span className="chat-file-bubble__action" aria-hidden="true">
                              {downloading[msg.attachment.name] ? (
                                <Loader2 size={16} className="chat-file-bubble__spin" />
                              ) : (
                                <Download size={16} />
                              )}
                            </span>
                          </button>
                        ) : (
                          <div
                            className={`chat-bubble ${isMine ? "chat-bubble--mine" : "chat-bubble--in"}`}
                            style={{ direction: isRtl ? "rtl" : "ltr" }}
                          >
                            {msg.content}
                          </div>
                        )}
                        <div className="chat-time">{formatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer — sticks to the bottom of the panel. Read-only when
                  the chat is paused / its request ended; admins who are not
                  participants get a "join to write" control instead. */}
              {composerLocked ? (
                <div
                  className="chat-composer-note"
                  role="status"
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                >
                  <Lock size={16} aria-hidden="true" />
                  <span>{chatPaused ? c.chatPausedNote : c.chatEndedNote}</span>
                </div>
              ) : isStaffViewer ? (
                <div
                  className="chat-composer-note"
                  role="status"
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                >
                  <Eye size={16} aria-hidden="true" />
                  <span>{c.staffViewNote}</span>
                  <button
                    type="button"
                    className="btn btn-ember btn-sm"
                    onClick={handleJoin}
                    disabled={joinBusy}
                    aria-busy={joinBusy}
                  >
                    {joinBusy ? (
                      <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus size={15} aria-hidden="true" />
                    )}
                    {joinBusy ? c.joining : c.joinChat}
                  </button>
                </div>
              ) : (
              <form
                onSubmit={handleSend}
                className="chat-composer"
                style={{ direction: isRtl ? "rtl" : "ltr" }}
              >
                {/* req 26 — file attach: hidden input driven by a paperclip btn */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFilePick}
                  disabled={uploading || sending}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="chat-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending}
                  aria-busy={uploading}
                  aria-label={uploading ? c.uploading : c.attachFile}
                  title={uploading ? c.uploading : c.attachFile}
                >
                  {uploading ? (
                    <Loader2 size={18} className="chat-attach-btn__spin" aria-hidden="true" />
                  ) : (
                    <Paperclip size={18} aria-hidden="true" />
                  )}
                </button>
                <input
                  type="text"
                  name="message"
                  autoComplete="off"
                  enterKeyHint="send"
                  className="chat-composer__input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={c.inputPH}
                  disabled={sending}
                  aria-label={c.inputPH}
                  style={{ direction: isRtl ? "rtl" : "ltr" }}
                />
                <button
                  type="submit"
                  className="btn btn-ember"
                  disabled={sending || !inputText.trim()}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}
                >
                  {sending ? c.sending : c.send}
                  <Send size={15} style={{ transform: isRTL ? "scaleX(-1)" : "none" }} />
                </button>
              </form>
              )}
            </div>
          </Reveal>

          {sendError && (
            <div
              className="chat-send-error"
              role="alert"
              style={{ direction: isRtl ? "rtl" : "ltr" }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{c.sendError}</span>
            </div>
          )}
        </div>

        {/* ── Context rail (offset inline-end): identity + status + actions ── */}
        <aside className="chat-window-rail">
          <Reveal>
            {/* Identity — two-person chats keep the single-face headline;
                groups / direct chats (and managers) get a participants list
                with per-person remove + an add control when permitted. */}
            {isGroup || canManageParticipants ? (
              <div className="chat-rail-identity">
                <h1 className="chat-rail-name">{groupName}</h1>
                {linkedRequestId && (
                  <p className="chat-rail-sub">
                    {c.request} {railRequestRef}
                  </p>
                )}
                <p className="chat-rail-people-label">{c.participantsTitle}</p>
                <ul className="chat-rail-people">
                  {Object.values(participants).map((p) => {
                    const name =
                      (p.displayName && p.displayName.trim()) ||
                      p.uid.slice(0, 6);
                    const isSelf = p.uid === user?.uid;
                    return (
                      <li key={p.uid} className="chat-rail-person">
                        {renderAvatar(name, p.avatarUrl, "sm")}
                        <span className="chat-rail-person__name">
                          {name}
                          {isSelf && (
                            <span className="chat-rail-person__you">
                              {" "}
                              ({c.youTag})
                            </span>
                          )}
                        </span>
                        {canManageParticipants && !isSelf && (
                          <button
                            type="button"
                            className="chat-rail-person__remove"
                            onClick={() => setRemoveTarget(p)}
                            aria-label={`${c.removePerson}: ${name}`}
                            title={c.removePerson}
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Add control: admin-only (the picker reads the admin user
                    roster; non-admin direct-chat creators have no source). */}
                {canManageParticipants && hasRole("admin") && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setAddError(null);
                      setAddOpen(true);
                    }}
                  >
                    <UserPlus size={15} aria-hidden="true" />
                    {c.addPerson}
                  </button>
                )}
              </div>
            ) : (
              <div className="chat-rail-identity">
                {otherParticipant ? (
                  renderAvatar(otherName, otherParticipant.avatarUrl, "lg")
                ) : (
                  <span
                    aria-hidden="true"
                    className="chat-avatar chat-avatar--lg"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--ember)",
                    }}
                  >
                    <MessageCircle size={24} />
                  </span>
                )}
                <h1 className="chat-rail-name">
                  {otherParticipant ? otherName : c.titleFallback}
                </h1>
                {linkedRequestId && (
                  <p className="chat-rail-sub">
                    {c.request} {railRequestRef}
                  </p>
                )}
              </div>
            )}

            {/* ── Note 6 / req 25 — linked-request status + lifecycle actions ── */}
            {linkedRequest && (
              <div
                className={`chat-rail-status${
                  linkedRequest.status === "closed" ? " chat-rail-status--closed" : ""
                }`}
                style={{ direction: isRtl ? "rtl" : "ltr" }}
              >
                <span className="chat-status">
                  <span className={`chat-status__dot ${statusDotClass}`} aria-hidden="true" />
                  <span className="chat-status__label">
                    {lc.statusLabels[
                      linkedRequest.status as keyof typeof lc.statusLabels
                    ] ?? linkedRequest.status}
                  </span>
                </span>

                {(canMarkDone ||
                  canUseCloseConsent ||
                  linkedRequest.status === "closed") && (
                  <div className="chat-rail-actions">
                    {canMarkDone && (
                      <button
                        type="button"
                        className="btn btn-ember btn-sm"
                        onClick={handleMarkDone}
                        disabled={markingDone}
                        aria-busy={markingDone}
                      >
                        {markingDone ? (
                          <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        )}
                        {lc.actions.markDone}
                      </button>
                    )}

                    {/* ── req 25 — mutual-consent close handshake ──────────── */}
                    {canUseCloseConsent && !closeReq && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleCloseAction("propose")}
                        disabled={closeBusy}
                        aria-busy={closeBusy}
                      >
                        {closeBusy ? (
                          <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 size={15} aria-hidden="true" />
                        )}
                        {c.requestClose}
                      </button>
                    )}

                    {canUseCloseConsent && closeReq && otherProposed && (
                      <>
                        <span className="chat-rail-note">
                          {c.otherAskedToClose(closeProposerName)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ember btn-sm"
                          onClick={() => handleCloseAction("approve")}
                          disabled={closeBusy}
                          aria-busy={closeBusy}
                        >
                          {closeBusy ? (
                            <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 size={15} aria-hidden="true" />
                          )}
                          {c.confirmClose}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleCloseAction("decline")}
                          disabled={closeBusy}
                        >
                          <XCircle size={15} aria-hidden="true" />
                          {c.declineClose}
                        </button>
                      </>
                    )}

                    {canUseCloseConsent && closeReq && iProposed && (
                      <>
                        <span className="chat-rail-note">
                          <Clock
                            size={14}
                            aria-hidden="true"
                            style={{ verticalAlign: "-2px", marginInlineEnd: "6px" }}
                          />
                          {c.waitingToClose}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleCloseAction("decline")}
                          disabled={closeBusy}
                          aria-busy={closeBusy}
                        >
                          {closeBusy ? (
                            <Loader2 size={15} className="chat-action-spin" aria-hidden="true" />
                          ) : (
                            <XCircle size={15} aria-hidden="true" />
                          )}
                          {c.cancelCloseRequest}
                        </button>
                      </>
                    )}

                    {linkedRequest.status === "closed" && (
                      <span className="chat-rail-note">{c.closed}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Reveal>
        </aside>
      </div>

      {/* Remove-participant confirmation (409 = protected core pair). */}
      <ConfirmDialog
        open={!!removeTarget}
        variant="danger"
        title={c.removeConfirmTitle}
        message={
          removeTarget
            ? c.removeConfirmBody(
                (removeTarget.displayName && removeTarget.displayName.trim()) ||
                  removeTarget.uid.slice(0, 6),
              )
            : ""
        }
        confirmLabel={c.removePerson}
        cancelLabel={t.common.cancel}
        busy={removeBusy}
        onConfirm={handleRemoveParticipant}
        onCancel={() => {
          if (!removeBusy) setRemoveTarget(null);
        }}
      />

      {/* Add-participant picker (admin-only data source). */}
      {hasRole("admin") && (
        <UserPickerDialog
          open={addOpen}
          heading={c.addPerson}
          confirmLabel={c.addPerson}
          busyLabel={c.addingPerson}
          busy={addBusy}
          error={addError}
          excludeUids={chatMeta?.participantUids ?? []}
          onConfirm={(uids) => handleAddPeople(uids)}
          onClose={() => {
            if (!addBusy) setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}
