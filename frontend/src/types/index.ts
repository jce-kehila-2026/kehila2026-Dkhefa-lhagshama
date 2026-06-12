// Shared domain types for the Push-for-Fulfillment frontend.
//
// These are pragmatic, intentionally loose shapes inferred from the mock data
// in `@/data/mockData` and `@/data/translations`. The dedicated typing phase
// will tighten and consume them; for now they exist so call sites can import a
// single canonical set instead of re-deriving inline shapes.

/**
 * Loosely-typed view of a value caught in a `catch` block. TypeScript only
 * permits `unknown`/`any` as the catch-variable annotation, so call sites cast
 * the caught value to this shape to read the optional fields the API/runtime
 * may attach (`@/lib/apiClient` throws `ApiError`, browser errors carry
 * `message`). Every access remains optional, so behaviour is unchanged.
 */
export interface CaughtError {
  status?: number;
  message?: string;
  detail?: { error?: string };
}

/**
 * Recursive, intentionally-loose view of the bilingual translation table and
 * any other dynamically-indexed JSON the UI treats as free-form. It behaves
 * like the former `any` at call sites — supports `t.a.b`, `t.x[key]`, and use as
 * a `ReactNode`/`string`/`Key` — without tripping `no-explicit-any`. Used only
 * where a value is genuinely dynamic; prefer concrete types everywhere else.
 */
export type TNode = string &
  ((...args: unknown[]) => TNode) & { [key: string]: TNode };

/**
 * Platform access role, sourced from a Firebase custom claim. These are the
 * three roles the role model (`useAuth().role` / `hasRole`) reasons about.
 * `admin` is a superset: it satisfies any `hasRole` check.
 *
 * Note: the wider codebase (admin user management) may also persist the legacy
 * `businessOwner` value as a raw claim string; it is intentionally outside this
 * gated union and is treated as "no gated role" by `hasRole`.
 */
export type Role = 'beneficiary' | 'volunteer' | 'admin';

/** UI language. Hebrew is the default / RTL language. */
export type Lang = 'he' | 'en';

/** Text direction tied to the active language. */
export type Dir = 'rtl' | 'ltr';

/** Broad service / activity area used to tag requests, NGOs and volunteers. */
export type Area =
  | 'education'
  | 'employment'
  | 'social'
  | 'legal'
  | 'housing'
  | string;

/**
 * An admin-managed help category (Firestore `categories/{id}` doc, feedback
 * round 2). Doc ids are slugs; labels are bilingual fields ON the doc, never
 * translations.ts entries. `archived` soft-hides a category from pickers
 * while old request docs keep resolving its label.
 */
export interface Category {
  id: string;
  nameHe: string;
  nameEn: string;
  archived?: boolean;
}

/**
 * Canonical lifecycle status of a beneficiary request (request-lifecycle spec).
 *
 * Authority is the backend transition map; these are the only states the
 * server persists:
 * - `pending`         — submitted, awaiting admin triage
 * - `in_progress`     — assigned to a volunteer / being worked
 * - `awaiting_review` — volunteer marked done, awaiting admin close
 * - `closed`          — completed (keys the beneficiary rating prompt)
 * - `rejected`        — declined by admin
 * - `referred`        — handed to a partner from the `answers` catalog
 *                       (terminal; counts as helped, sets `archived = true`)
 *
 * NOTE: the legacy `resolved` status is **retired** — the rating prompt now
 * keys off `closed`. The `| string` tail is an intentional, pragmatic escape
 * hatch kept so stale mock data and in-flight consumer screens keep compiling
 * while they are reconciled to the canonical literals in parallel phases.
 */
export type RequestStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_review'
  | 'closed'
  | 'rejected'
  | 'referred'
  | string;

export type Urgency = 'low' | 'medium' | 'high' | string;

export type VolunteerStatus = 'available' | 'assigned' | string;

/** A community-owned business listed in the directory (UC-03). */
export interface Business {
  id: number | string;
  name: string;
  logo?: string;
  logoColor?: string;
  category: string;
  desc?: string;
  descEn?: string;
  tags?: string[];
  tagsEn?: string[];
  city?: string;
  cityEn?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  approved?: boolean;
  featured?: boolean;
}

/** A partner NGO / organization in the "answers" catalog (UC-02). */
export interface NGO {
  id: number | string;
  name: string;
  nameEn?: string;
  logo?: string;
  logoColor?: string;
  area?: string;
  areaEn?: string;
  areas?: Area[];
  desc?: string;
  descEn?: string;
  tags?: string[];
  tagsEn?: string[];
  phone?: string;
  website?: string;
}

/** Alias kept for readability at NGO/partner call sites. */
export type Partner = NGO;

/** A registered volunteer (UC-04 / volunteer directory). */
export interface Volunteer {
  id: number | string;
  name: string;
  nameEn?: string;
  initials?: string;
  profession?: string;
  professionEn?: string;
  areas?: Area[];
  availability?: string;
  availabilityEn?: string;
  city?: string;
  cityEn?: string;
  status?: VolunteerStatus;
  joinedDate?: string;
  assignedTo?: string | null;
  /** Self-set availability (req 14e): free / working / unavailable. */
  workStatus?: 'free' | 'working' | 'unavailable';
  /** Categories the admin approved the volunteer for (informational, req 15). */
  approvedCategories?: string[];
  /** Pending/decided category permission requests (req 15). */
  requestedCategories?: CategoryRequest[];
}

/**
 * A referral of a request to a partner in the live `answers` catalog (Note 8).
 * Set server-side by `POST /api/admin/requests/:id/refer`; the request then
 * moves to `referred` (terminal, archived). The beneficiary sees
 * `partnerName` (+ contact) as a timeline event.
 */
export interface Referral {
  /** Id of the chosen `answers` catalog entry (the partner). */
  answerId: string;
  /** Resolved display name of the partner (snapshotted from the answer). */
  partnerName: string;
  /** Optional free-text note from the admin to the beneficiary. */
  note?: string;
  /** ISO timestamp the referral was made (server-stamped). */
  referredAt?: string;
  /** Uid of the admin who made the referral. */
  referredBy?: string;
}

/**
 * Metadata for a file attached to a request, embedded on the request itself
 * (no separate `attachments` collection — Note 1). Populated by the upload
 * route; `path` is a Storage path (`requests/{id}/{file}`), never a public URL
 * — the backend mints short-lived signed URLs via
 * `GET /api/requests/:id/attachments/:name` for admin + the assigned volunteer.
 */
export interface Attachment {
  /** File name; also the lookup key for the signed-URL endpoint. */
  name: string;
  /** Firebase Storage path (not a fetchable URL). */
  path: string;
  /** MIME type. */
  type: string;
  /** Size in bytes. */
  size: number;
  /** Uid of the uploader. */
  uploadedBy?: string;
  /**
   * Whether this attachment is visible to volunteers (req 21). Beneficiary
   * uploads default to visible; on admin task requests the admin chooses per
   * file. Private files are never exposed through the volunteer view.
   */
  volunteerVisible?: boolean;
}

/** A volunteer's claim on an available request (req 16 / req 22). */
export interface RequestClaim {
  /** Uid of the volunteer requesting the request. */
  volunteerId: string;
  /** Volunteer's display name (snapshotted for the admin list). */
  volunteerName?: string;
  /** Free-text note: why they want this request (req 22). */
  note?: string;
  /** ISO timestamp the claim was made. */
  claimedAt?: string;
}

/** A volunteer's hand-off report when self-dropping a stuck request (req 18). */
export interface DropReport {
  volunteerId: string;
  volunteerName?: string;
  /** What the volunteer did. */
  done?: string;
  /** Where they got to. */
  reached?: string;
  /** Where they got stuck. */
  stuck?: string;
  /** ISO timestamp of the drop. */
  droppedAt?: string;
}

/** A beneficiary assistance request (UC-01). */
export interface Request {
  id: string;
  firstName?: string;
  lastName?: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  city?: string;
  cityEn?: string;
  category: string;
  description?: string;
  status: RequestStatus;
  urgency?: Urgency;
  date?: string;
  handler?: string | null;
  handlerEn?: string | null;
  notes?: string;
  idUploaded?: boolean;
  /**
   * Archived flag (default false). Separate from `status` so archived requests
   * stay queryable for stats; active lists exclude `archived === true`.
   * `referred` requests are archived (count as helped).
   */
  archived?: boolean;
  /** Partner referral, set when `status === 'referred'` (Note 8). */
  referral?: Referral;
  /** Embedded file-attachment metadata (Note 1). */
  attachments?: Attachment[];
  /**
   * True when a volunteer/admin submitted this request on behalf of a
   * low-digital-literacy beneficiary who has no account (UC-01 A2).
   */
  onBehalf?: boolean;
  /** Uid of the account that actually submitted the request. */
  submittedBy?: string;
  /** Role of the submitting account (e.g. `volunteer`) at submit time. */
  submittedByRole?: string;
  /** ISO deadline date (optional). */
  deadline?: string | null;
  /** Beneficiary age captured at submit time (feeds age insights, req 24). */
  age?: number | null;
  // ── Pool / claim / task fields (reqs 16, 18, 20, 22) ──────────────────────
  /** Who created the request. `admin` task requests show a "from admin" badge. */
  origin?: 'beneficiary' | 'admin';
  /** `task` = an admin-authored job for volunteers (req 20). */
  requestType?: 'assistance' | 'task';
  /** Short title (admin task requests). */
  title?: string;
  /** `available` = claimable by volunteers in the pool (req 16). */
  poolStatus?: 'none' | 'available';
  /** True when one or more volunteers have claimed it (req 22). */
  hasClaims?: boolean;
  /** Volunteers who requested this request (req 22). */
  claims?: RequestClaim[];
  /** True if a volunteer took then dropped this request before (reqs 18, 19). */
  wasPreviouslyTaken?: boolean;
  /** Hand-off reports from volunteers who dropped the request (req 18). */
  dropReports?: DropReport[];
  /** Uid of the assigned volunteer (mirrors `handler` in many flows). */
  assignedVolunteerId?: string | null;
  /** Mutual-consent close handshake (req 25); null when no close is proposed. */
  closeRequest?: CloseRequest | null;
}

/** Mutual-consent close handshake on a request/chat (req 25). */
export interface CloseRequest {
  proposedBy: string;
  proposedRole: 'volunteer' | 'beneficiary';
  proposedAt?: string;
  volunteerApproved: boolean;
  beneficiaryApproved: boolean;
}

/** A file attached to a chat message (req 26). */
export interface ChatAttachment {
  name: string;
  /** Storage path (not a fetchable URL); download via signed-URL endpoint. */
  path: string;
  type: string;
  size: number;
}

/** A pending request from a volunteer to take a category of work (req 15). */
export interface CategoryRequest {
  category: string;
  note?: string;
  requestedAt?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * A community "answer" surfaced as a suggestion after a beneficiary submits
 * (UC-01 A1, simple If-Then). Mirrors the `answers` API item shape but kept
 * permissive: bilingual text fields may arrive as a `{ he, en }` object or a
 * plain string, so consumers render the active-language value.
 */
export interface Suggestion {
  id: string;
  title?: string | { he?: string; en?: string } | null;
  body?: string | { he?: string; en?: string } | null;
  category?: string | null;
  region?: string | { he?: string; en?: string } | null;
  audience?: string | { he?: string; en?: string } | null;
  sourceName?: string | { he?: string; en?: string } | null;
  sourceUrl?: string | null;
  /**
   * Directory organization type: 'ngo' (עמותה) vs admin-added 'partner'
   * (שותף). Docs created before the field existed count as 'ngo' (the API
   * applies that default server-side).
   */
  orgType?: OrgType | null;
  acceptsInAppRequest?: boolean;
  createdAt?: string | null;
}

/** Organization type of a directory answer (see Suggestion.orgType). */
export type OrgType = 'ngo' | 'partner';

/** A platform user / account (admin user management). */
export interface AdminUser {
  id: number | string;
  name: string;
  nameEn?: string;
  /** Optional human-friendly name (backs the chat identity, Note 11). */
  displayName?: string;
  email?: string;
  phone?: string;
  city?: string;
  /**
   * Storage path to the user's avatar (e.g. `avatars/{uid}/avatar.jpg`), not a
   * public URL — short-lived signed URLs are minted by the backend (Note 11).
   */
  photoURL?: string;
  requests?: number;
  joined?: string;
  active?: boolean;
}

/** A success / testimonial story shown on the homepage. */
export interface Story {
  id: number | string;
  name: string;
  nameEn?: string;
  role?: string;
  roleEn?: string;
  quote?: string;
  quoteEn?: string;
  category?: string;
  rating?: number;
  avatar?: string;
  image?: string;
}

/** An FAQ entry. */
export interface FAQ {
  id: number | string;
  question: string;
  questionEn?: string;
  answer: string;
  answerEn?: string;
  category?: string;
}

/** A team / staff member. */
export interface TeamMember {
  id: number | string;
  name: string;
  nameEn?: string;
  role?: string;
  roleEn?: string;
  initials?: string;
}

/** A single aggregate metric / KPI used by stat cards. */
export interface Stat {
  label?: string;
  labelEn?: string;
  value: number | string;
  [key: string]: number | string | undefined;
}

/** A service / activity offering. */
export interface Service {
  id?: number | string;
  title?: string;
  titleEn?: string;
  desc?: string;
  descEn?: string;
  icon?: string;
  category?: string;
}

/** A single message inside an internal chat (UC-04). */
export interface Message {
  id: number | string;
  chatId?: number | string;
  senderId?: number | string;
  author?: string;
  text: string;
  createdAt?: string;
  mine?: boolean;
  /** Optional file attachment on the message (req 26). */
  attachment?: ChatAttachment | null;
}

/**
 * Aggregated admin insights payload (Note 7), returned by
 * `GET /api/admin/insights` and consumed by the recharts dashboard. Computed
 * on request from `requests` + `requestEvents` (per-transition timestamps).
 */
export interface InsightsData {
  /** Requests created per day. */
  overTime: { date: string; count: number }[];
  /** Request counts grouped by category. */
  byCategory: { category: string; count: number }[];
  /** Request counts grouped by current status. */
  byStatus: { status: string; count: number }[];
  /** Mean days from creation to `closed`; `null` when nothing has closed. */
  avgResolutionDays: number | null;
  /** Per-volunteer handled-request counts. */
  perVolunteer: { uid: string; name: string; count: number }[];
  /** Beneficiary age stats (req 24): mean + bucketed distribution. */
  ageStats?: {
    averageAge: number | null;
    buckets: { label: string; count: number }[];
  };
}

/** A volunteer's own analytics (req 14b — GET /api/volunteer/insights). */
export interface VolunteerInsights {
  overTime: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  avgResolutionDays: number | null;
  currentLoad: number;
}

/** A volunteer's self profile bits (GET /api/volunteer/me). */
export interface VolunteerMe {
  workStatus: 'free' | 'working' | 'unavailable';
  approvedCategories: string[];
  requestedCategories: CategoryRequest[];
}

/**
 * Kind of a chat document (feedback round 2). `request` chats are bound to a
 * request via `requestId`; `direct` chats are admin-created staff/group chats
 * with no request. Docs created before the field existed count as `request`.
 */
export type ChatKind = 'request' | 'direct';

/** A chat conversation thread (UC-04). */
export interface ChatThread {
  id: number | string;
  title?: string;
  participant?: string;
  participantEn?: string;
  lastMessage?: string;
  unread?: number;
  updatedAt?: string;
  messages?: Message[];
  /** Request-bound vs. direct staff chat; missing = `request` (legacy docs). */
  kind?: ChatKind;
  /**
   * Live flag (feedback round 2): false on all request end states and when an
   * admin pauses the chat. Inactive chat = read-only composer. Missing = true.
   */
  active?: boolean;
  /** Uid of the creator; `system` for assignment-created chats. The direct-chat
   * creator manages its participants (admins manage any chat). */
  createdBy?: string;
}
