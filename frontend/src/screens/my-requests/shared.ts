// shared types, constants, and style tokens for the my-requests screen
// (the beneficiary's "my submitted requests" view, HE/EN). this module is the
// single source of truth co-imported by the my-requests page + its sub-views:
// the api-shaped record/event types they narrow against, the cross-page
// save-to-profile handoff contract (sessionStorage key + payload shape), and
// the small presentational helpers (eyebrow label style, lifecycle status pill
// palette). pure data/style only, no react/runtime logic here.
import type { CSSProperties } from "react";
import type { TNode, Referral } from "@/types";

// `t` is the bilingual translation table — consumed via dynamic key lookups
// (`t.myRequests.categories[cat]`, `tl.types[ev.type]`), so use the loose
// `TNode` view rather than the precise per-key context type.
export type Translations = TNode;

// A request record / timeline event as returned by the API: loose JSON shapes,
// narrowed to the fields actually read at the call sites below.
export interface RequestRecord {
  id: string;
  /** Friendly reference "REQ-####" (WS-3); falls back to a short UUID slice. */
  displayId?: string | null;
  status: string;
  description?: string;
  category: string;
  urgency: string;
  createdAt?: string;
  deadline?: string | null;
  attachmentPaths?: string[];
  /** Embedded attachment metadata (Note 1) — fall back to count when present. */
  attachments?: { name: string }[];
  /** Archived flag — archived requests are grouped as "past" (Note 6). */
  archived?: boolean;
  /** Partner referral, set when status === 'referred' (Note 8). */
  referral?: Referral;
}
export interface TimelineEvent {
  id?: string | number;
  type: string;
  createdAt?: string;
}

// #67 — personal fields stashed by RequestsPage right before its post-submit
// redirect (its in-form save-to-profile offer could never render). Read here
// when arriving via ?new=, offered once, and cleared on save or dismiss so
// the details do not outlive the offer.
export const SAVE_PROFILE_OFFER_KEY = "pff:saveProfileOffer";
export interface SaveProfileOffer {
  /** Uid of the account that submitted — a stash from any other (or unknown)
   * account is discarded on read, so PII never crosses an account switch. */
  uid?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  age?: string;
  gender?: string;
}

// ── Small monospace eyebrow/label helper ──────────────────────
export const labelStyle: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--gray-500)",
};

// ── Lifecycle status pill (Notes 6, 8) ───────────────────────
// Renders the canonical request statuses with the bilingual lifecycle
// status-label keys (incl. awaiting_review / closed / rejected / referred).
// Colour comes from existing editorial tokens only — no new colours.
export const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  pending:         { bg: "var(--sky-2)",      fg: "var(--ink-2)" },
  in_progress:     { bg: "var(--warning-soft)", fg: "var(--warning)" },
  awaiting_review: { bg: "var(--ember-soft)", fg: "var(--ember-700)" },
  closed:          { bg: "var(--success-soft)", fg: "var(--success)" },
  rejected:        { bg: "var(--danger-soft)", fg: "var(--danger)" },
  referred:        { bg: "var(--ember-soft)", fg: "var(--ember-700)" },
};
