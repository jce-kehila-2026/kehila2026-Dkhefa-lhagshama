import type { RequestStatus, CloseRequest, ChatKind } from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

/** Client-side attachment guard (req 26): PDF / JPEG / PNG / DOCX, <= 10MB. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
/** Extension fallback for browsers that report an empty/odd MIME type. */
export const ALLOWED_ATTACHMENT_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".docx"];

/** Human-readable file size (matches the request-form attachment style). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A chat participant as returned by GET /api/chats/:id/participants. */
export interface ChatParticipant {
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
export interface ChatMeta {
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
export interface LinkedRequest {
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
export function toInitials(label: string | undefined | null): string {
  const s = String(label ?? "").trim();
  if (!s) return "?";
  const parts = s.replace(/[._-]+/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// Map a GET /api/requests/:id payload onto our minimal LinkedRequest.
export function projectLinkedRequest(
  data: Partial<LinkedRequest> & { id?: string },
): LinkedRequest | null {
  if (typeof data?.id !== "string" || typeof data.status !== "string") return null;
  return {
    id: data.id,
    displayId: data.displayId ?? null,
    status: data.status,
    handler: data.handler ?? null,
    assignedVolunteerId: data.assignedVolunteerId ?? null,
    beneficiaryId: data.beneficiaryId ?? null,
    closeRequest: data.closeRequest ?? null,
  };
}
