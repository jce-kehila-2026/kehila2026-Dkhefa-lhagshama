# Data Model Deltas — Volunteer + Admin Operations

New Firestore fields introduced by the volunteer hub and the expanded admin operations. These are **additive** — no existing field changed type or meaning. This doc is the source of truth for what still needs to be reflected in `db-design.drawio` (and re-exported for the wiki).

The diagram is hand-edited in app.diagrams.net (draw.io). Open `sem2/db-design.drawio`, apply the TODO below, then `File ▸ Export as` PNG/SVG and update the wiki Architecture & Design page.

## New / changed fields by collection

### `requests`

| Field | Type | Purpose |
|---|---|---|
| `origin` | enum(`beneficiary`, `admin`) | Who authored the request. `admin` = an admin-created task request. |
| `requestType` | enum(`assistance`, `task`) | `assistance` = beneficiary help request; `task` = admin-authored work for volunteers. |
| `title` | string | Short title (primarily for task requests / pool display). |
| `poolStatus` | enum(`none`, `available`) | Whether the request is in the volunteer pool (`available`) or not (`none`). |
| `hasClaims` | boolean | Convenience flag — true when one or more volunteers have claimed the request. |
| `claims` | array<{ volunteerId, volunteerName, note, claimedAt }> | Volunteers who claimed the request, with their notes. Cleared when an admin assigns one. |
| `wasPreviouslyTaken` | boolean | True after a self-drop returns the request to the pool; flags it as "previously taken" and affects sort order. |
| `dropReports` | array<{ volunteerId, volunteerName, done, reached, stuck, droppedAt }> | History of volunteer self-drop reports. |
| `attachments[].volunteerVisible` | boolean | Per-attachment flag — whether a volunteer may see this file (set on upload via `?volunteerVisible=`). New field **inside** the existing `attachments` array element. |

> `deadline` and `age` are used by these features but are **not** new — confirm they are present on the `requests` entity in the diagram (see TODO).

### `volunteers`

| Field | Type | Purpose |
|---|---|---|
| `workStatus` | enum(`free`, `working`, `unavailable`) | Volunteer-set availability. |
| `approvedCategories` | string[] | Categories an admin approved for the volunteer (informational only — does not gate access). |
| `requestedCategories` | array<{ category, note, requestedAt, status }> | Pending/decided category-permission requests submitted by the volunteer. |

## TODO — edit `db-design.drawio` then re-export

Apply these in app.diagrams.net, then export PNG/SVG and update the wiki.

- [ ] **`requests` entity** — add the new attribute rows, matching the existing `+ name: type` style:
  - `+ origin: enum(beneficiary,admin)`
  - `+ requestType: enum(assistance,task)`
  - `+ title: string`
  - `+ poolStatus: enum(none,available)`
  - `+ hasClaims: boolean`
  - `+ claims: array<{volunteerId,volunteerName,note,claimedAt}>`
  - `+ wasPreviouslyTaken: boolean`
  - `+ dropReports: array<{volunteerId,volunteerName,done,reached,stuck,droppedAt}>`
  - Update the existing `attachments` row to note the new per-element flag, e.g. `+ attachments: array<{name,path,type,size,uploadedBy,volunteerVisible}>`.
- [ ] **`requests` entity — verify, don't duplicate** — confirm `+ deadline: timestamp` and `+ age: number` already exist; if missing, add them (the current diagram does **not** show them, so they likely need adding).
- [ ] **`volunteers` entity** — the current diagram collapses volunteer data into `users` and has **no separate `volunteers` box**. Add a new `volunteers` entity (or, if keeping the 10-entity collapsed layout, document these as a sub-block) with:
  - `+ volunteerId: string` (= the user uid)
  - `+ workStatus: enum(free,working,unavailable)`
  - `+ approvedCategories: array<string>`
  - `+ requestedCategories: array<{category,note,requestedAt,status}>`
  - If added as a standalone entity, draw a `1 — 0..*` relation `volunteers → requests` (a volunteer is assigned to / claims many requests), and a `1 — 1` relation `users → volunteers`.
- [ ] **Re-export** — `File ▸ Export as` PNG and SVG, replace the images on the wiki Architecture & Design page, and confirm the entity count / legend text still matches.

## Round 2 — closing, chat files, notifications (reqs 25–27)

A second round of features (mutual-consent close, chat attachments, email notifications) adds a few more fields. Still **additive** — no existing field changed type or meaning.

### New / changed fields by collection

| Collection | Field | Type | Purpose |
|---|---|---|---|
| `requests` | `closeRequest` | `{ proposedBy, proposedRole, proposedAt, volunteerApproved, beneficiaryApproved }` \| `null` | Pending mutual-consent close. Set on `propose`; both `*Approved` true → request goes to `closed`; `decline` resets it to `null`. |
| `chats` | `active` | boolean (default `true`) | Whether the chat is live. Set `false` when the request is closed. |
| `chats` | `lastReplyNotifyAt` | string (ISO) | Throttle marker for the volunteer-reply email (≈once per 15 min per chat). |
| `messages` | `attachment` | `{ name, path, type, size }` \| `null` | File attached to a message. Stored under `chats/{chatId}/{file}`; downloaded via a backend-minted signed URL. |

### TODO — edit `db-design.drawio` then re-export

Apply these in app.diagrams.net, then export PNG/SVG and update the wiki.

- [ ] **`requests` entity** — add `+ closeRequest: {proposedBy,proposedRole,proposedAt,volunteerApproved,beneficiaryApproved} | null`.
- [ ] **`chats` entity** — add `+ active: boolean` and `+ lastReplyNotifyAt: string`.
- [ ] **`messages` entity** — add `+ attachment: {name,path,type,size} | null`.
- [ ] **Re-export** — `File ▸ Export as` PNG and SVG, replace the images on the wiki Architecture & Design page.

### Env vars (email notifications)

These are not Firestore fields, but they gate the notification channel (`lib/notify.ts`) and belong in the backend `.env` / deploy config:

- `SENDGRID_API_KEY` — SendGrid API key (channel is the SendGrid REST API via global `fetch`).
- `NOTIFY_FROM_EMAIL` — verified sender address.
- `NOTIFY_REPLY_TO` — optional reply-to address.

If `SENDGRID_API_KEY` / `NOTIFY_FROM_EMAIL` are unset, notifications are logged (`[notify:log] ...`) instead of sent, so the flow works without credentials.

## Round 2 — directory management (2026-06-12)

Admin directory CRUD (`/api/admin/directory/*`) splits the partner catalog (`answers`) into NGO vs partner org types. Still **additive** — no existing field changed type or meaning.

### New / changed fields by collection

| Collection | Field | Type | Purpose |
|---|---|---|---|
| `answers` | `orgType` | enum(`ngo`, `partner`) | Directory organization type: `ngo` = עמותה, `partner` = שותף (admin-added partner). **Absent = `ngo`** — docs created before this field count as NGOs; every reader applies that default (no backfill needed). |
| `answers` | `createdBy` | string (uid) | Admin uid for answers created via `POST /api/admin/directory/answers`. Seeded / legacy answers don't carry it. |
| `businesses` | `createdBy` | string (uid) | Admin uid for businesses created via `POST /api/admin/directory/businesses`. These docs also carry `ownerId: null` (admin-created — no owner-edit path), where user-submitted businesses have a real `ownerId`. |

### TODO — edit `db-design.drawio` then re-export (human step)

Apply these in app.diagrams.net, then export PNG/SVG and update the wiki.

- [ ] **`answers` entity** — add `+ orgType: enum(ngo,partner)` and `+ createdBy: string`, matching the existing `+ name: type` style.
- [ ] **`businesses` entity** — add `+ createdBy: string` and note `ownerId` is now nullable (admin-created docs).
- [ ] **Re-export** — `File ▸ Export as` PNG and SVG, replace the images on the wiki Architecture & Design page.

## Round 2 — admin-managed categories (2026-06-12)

Request categories move from a hardcoded 4-key enum to the (already seeded) Firestore `categories` collection, managed by admins via `/api/admin/categories` and read publicly via `GET /api/categories` + a new public-read rules block. Still **additive** — no existing field changed type or meaning.

### New / changed fields by collection

| Collection | Field | Type | Purpose |
|---|---|---|---|
| `categories` | `archived` | boolean (default `false`) | Soft archive. `true` hides the category from pickers and from new-input validation, but the doc (and its `nameHe`/`nameEn` labels) stays readable so historical requests/answers keep resolving labels. **Absent = `false`** — seeded docs created before the flag count as active. |
| `categories` | `createdAt` / `updatedAt` | timestamp | Set by the admin CRUD endpoints (`POST`/`PATCH /api/admin/categories`). Seeded docs may lack them. |

### Behavioral notes (no schema change)

- `requests.category` (and the task-create / volunteer category-permission inputs) are now validated **dynamically** against the live `categories` collection instead of a static zod enum: new input must match an **active** (non-archived) id; the admin category-permission decision endpoint accepts **any** id (archived ok — historical). Validation **fails open** (accepts with a server warning) when the collection is empty/unreadable, so an unseeded environment never hard-fails.
- Old request docs keep their raw `category` string keys; every label lookup falls back to the raw key, so no data migration is required.
- Category labels come from the doc's `nameHe`/`nameEn` (bilingual field contract), **never** from `translations.ts`.
- Hard delete of a category is refused (409 `category_in_use`) while any request or answer references the id — checked with two single-field `where ... limit 1` queries (no composite index).

### TODO — edit `db-design.drawio` then re-export (human step)

Apply these in app.diagrams.net, then export PNG/SVG and update the wiki.

- [ ] **`categories` entity** — the diagram already lists `categories` as a taxonomy entity; add `+ archived: boolean` (and `+ createdAt/updatedAt: timestamp` if the entity shows timestamps), matching the existing `+ name: type` style.
- [ ] **`requests` entity** — change the `category` attribute note from a fixed enum to `+ category: string (FK → categories.id, raw key kept for history)`.
- [ ] **Re-export** — `File ▸ Export as` PNG and SVG, replace the images on the wiki Architecture & Design page.

## Round 2 — direct chats + admin chat oversight (2026-06-12)

Chats gain a kind (request-bound vs admin-created direct/staff chats), a creator, an optional title, and a *meaningful* `active` flag. Still **additive** — no existing field changed type or meaning; old chat docs missing the new fields are read tolerantly everywhere (missing `kind` = `request`, missing `active` = `true`).

### New / changed fields by collection

| Collection | Field | Type | Purpose |
|---|---|---|---|
| `chats` | `kind` | enum(`request`, `direct`) | `request` = bound to a request (assignment-created); `direct` = admin-created staff/group chat with no request. **Absent = `request`**. |
| `chats` | `createdBy` | string (uid or `'system'`) | Who created the chat. `'system'` for assignment-created chats; the admin's uid for `POST /api/chats/direct`. On direct chats the creator manages participants (admins manage participants on any chat). |
| `chats` | `title` | string \| null | Optional display title — direct chats only (request chats store `null`). Max 120 chars. |
| `chats` | `requestId` | string \| **null** | Now nullable: direct chats carry `requestId: null`. (Previously always a request id.) |
| `chats` | `active` | boolean (default `true`) | **Semantics upgraded** (field itself existed since round-2 close-consent): now set `false` on ALL request end states (`closed`, `rejected`, `referred`) — not just mutual-consent close — set back `true` on admin reopen (`closed → in_progress`), and toggleable by an admin via `PATCH /api/admin/chats/:id`. Inactive chat = read-only composer (server rejects message/attachment posts with 409 `chat_inactive`). **Absent = `true`**. |
| `messages` | `targetUid` | string (optional) | On participant add/remove system messages: the uid of the affected user, so the UI can name them. |
| `messages` | `targetName` | string (optional) | Display name of `targetUid`, denormalized at system-message write time (via `lib/displayName.ts`) so the note keeps a readable name after the user leaves the chat. Absent when the name could not be resolved — the UI falls back to the live participants map, then a uid fragment. |

### Behavioral notes (no schema change)

- System messages keep the chat-on-assign convention (`senderId: 'system'`, `isSystem: true`, content prefixed `[SYSTEM] `) and now carry machine-readable markers the frontend translates: `chat_created`, `participant_added`, `participant_removed`, `chat_paused`, `chat_resumed`.
- Firestore rules: `/chats` and `/messages` reads gain an `isAdmin()` carve-out (read-only oversight). All client writes stay denied; admins may **post** only after joining as a participant (`POST /api/chats/:id/participants`).
- On `request`-kind chats, the linked request's `beneficiaryId` and current `assignedVolunteerId` cannot be removed from participants (409 `protected_participant`).
- No new Firestore composite index: `GET /api/admin/chats` is a full-collection get with in-memory sort/limit, and the existing `chats(participants CONTAINS, lastMessageAt DESC)` index keeps covering the client chat list (direct chats appear there through the same `participants array-contains` query).

### TODO — edit `db-design.drawio` then re-export (human step)

Apply these in app.diagrams.net, then export PNG/SVG and update the wiki.

- [ ] **`chats` entity** — add `+ kind: enum(request,direct)`, `+ createdBy: string (uid | 'system')`, `+ title: string | null`; change `requestId` to `+ requestId: string | null (null = direct chat)`; annotate `active` as "false on closed/rejected/referred + admin toggle".
- [ ] **`messages` entity** — add `+ targetUid: string (system messages only)` and `+ targetName: string (denormalized display name, system messages only)`.
- [ ] **Re-export** — `File ▸ Export as` PNG and SVG, replace the images on the wiki Architecture & Design page.

## Notes

- No schema change here requires a new Firestore composite index — the volunteer pool, assigned, and admin request lists use single-field queries plus in-memory sort/filter (`lib/requestSort.ts`).
- The category-permission fields (`approvedCategories` / `requestedCategories`) are **informational only** — they do not gate access in code or in rules.
