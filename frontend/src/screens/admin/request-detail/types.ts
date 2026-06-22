import type { CSSProperties } from 'react'
import type { Attachment, CloseRequestSummary, RequestStatus } from '@/types'

// ── Transition map (mirrors the backend authority in lib/requestTransitions).
// Only legal admin moves are listed; the UI renders a control per legal move
// from the request's current status. `referred` is handled by the dedicated
// refer action, and `archived` is a boolean flag set via the archive endpoint.
export const ADMIN_TRANSITIONS: Record<string, RequestStatus[]> = {
  pending: ['in_progress', 'rejected'],
  // An admin alone may one-step close an in-progress request (no
  // awaiting_review stop) — mirrors the backend map on this branch.
  in_progress: ['awaiting_review', 'closed', 'referred', 'rejected'],
  awaiting_review: ['closed', 'in_progress'],
  closed: ['in_progress'],
  referred: [],
  rejected: [],
}

// A partner option sourced from the live answers catalog (Note 8). Titles are
// bilingual { he, en }; we resolve to the active language for display.
export interface AnswerOption {
  id: string
  title?: { he?: string; en?: string } | string | null
  sourceName?: { he?: string; en?: string } | string | null
  sourceUrl?: string | null
}

// A single audit/timeline event on a request. `details` is genuinely dynamic
// per event type, so it stays loose.
export interface RequestEvent {
  id: string
  type: string
  createdAt?: string | number | Date
  details?: { volunteerId?: string; to?: string; note?: string; [key: string]: unknown }
}

// A volunteer who has expressed interest in (claimed) a pooled request (req 22).
export interface RequestClaim {
  volunteerId: string
  volunteerName?: string
  note?: string
  claimedAt?: string | number | Date
}

// A request as returned by GET /api/admin/requests/:id. Loose by design — only
// the fields this screen reads are declared.
export interface RequestDetail {
  id: string
  // Server-allocated friendly reference ("REQ-0042"); returned by the
  // GET :id `...data` spread. Rendered via formatRequestRef so the raw UUID
  // never surfaces (FIX 1).
  displayId?: string | null
  firstName?: string
  lastName?: string
  title?: string
  description?: string
  category?: string
  city?: string
  status?: string
  assignedVolunteerId?: string
  // Denormalized name captured at assign time (adminRequests POST /assign).
  // Survives the assigned volunteer being deactivated, unlike the live list lookup.
  assignedVolunteerName?: string | null
  language?: string
  preferredLanguage?: string
  events?: RequestEvent[]
  archived?: boolean
  attachments?: Attachment[]
  referral?: { partnerName?: string; note?: string }
  onBehalf?: boolean
  submittedBy?: string
  submittedByRole?: string
  claims?: RequestClaim[]
  hasClaims?: boolean
  origin?: string
  requestType?: string
  // Pending consent-close handshake (req 25), null/absent when none.
  closeRequest?: CloseRequestSummary | null
  [key: string]: unknown
}

// An active volunteer as returned by GET /api/admin/volunteers.
export interface ActiveVolunteer {
  uid: string
  fullName?: string
  languages?: string[]
  [key: string]: unknown
}

// A ranked match candidate from GET /api/admin/requests/:id/candidates (WS-6).
export interface MatchReason {
  key:
    | 'sameCategory'
    | 'relatedArea'
    | 'speaksLanguage'
    | 'currentlyFree'
    | 'lowLoad'
    | 'availableBeforeDeadline'
    | 'nearby'
    | 'highlyRated'
    | 'atCapacity'
  lang?: string
  count?: number
  rating?: number
}
export interface Candidate {
  uid: string
  name: string
  score: number
  /** 0-100 normalized match (Tier B) — shown in the UI instead of raw score. */
  matchPercent: number
  reasons: MatchReason[]
  workStatus: string
  openLoad: number
  languages: string[]
  city?: string | null
  avgRating?: number | null
  ratingCount?: number
  hasClaimed: boolean
}

// WS-6 — the ranked-matching i18n sub-block nested under reqDetail. Spelled out
// so the candidate UI can read it without an `any` cast.
export type MatchingCopy = {
  heading: string
  subtitle: string
  score: string
  match: string
  why: string
  showAll: string
  hideAll: string
  assign: string
  assigning: string
  empty: string
  loadError: string
  claimedTag: string
  openTasks: string
  reassign: string
  cancelReassign: string
  searchPlaceholder: string
  noMatches: string
  reasons: Record<string, string>
  langLabels: Record<string, string>
}

// The translation bundle slice consumed here (t.admin). Loose so we don't
// duplicate the full translation typing that lives elsewhere. `reqDetail`
// carries flat strings plus the nested `matching` block (WS-6).
export type AdminCopy = {
  statusLabels: Record<string, string>
  roleLabels: Record<string, string>
  reqDetail: { [key: string]: string | MatchingCopy }
  [key: string]: unknown
}

// A pending lifecycle transition awaiting confirmation. `kind` selects the
// confirm copy + the endpoint to call; `to` is the target status (omitted for
// archive, which hits its own endpoint).
export type TransitionKind = 'start' | 'close' | 'reopen' | 'reject' | 'sendBack' | 'archive'
export interface PendingTransition {
  kind: TransitionKind
  to?: RequestStatus
}

// The resolved matching i18n block (the `as unknown as` shape the screen reads).
export type MatchingI18n = {
  heading: string; subtitle: string; score: string; match: string; why: string
  showAll: string; hideAll: string; assign: string; assigning: string
  empty: string; loadError: string; claimedTag: string; openTasks: string
  reassign: string; cancelReassign: string
  searchPlaceholder: string; noMatches: string; prev: string; next: string
  reasons: Record<string, string>; langLabels: Record<string, string>
}

// Shared eyebrow treatment used to label each block — matches the marketing
// surfaces (uppercase mono, ember accent, generous tracking).
export const EYEBROW: CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ember)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}
