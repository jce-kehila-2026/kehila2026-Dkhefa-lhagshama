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

## Notes

- No schema change here requires a new Firestore composite index — the volunteer pool, assigned, and admin request lists use single-field queries plus in-memory sort/filter (`lib/requestSort.ts`).
- The category-permission fields (`approvedCategories` / `requestedCategories`) are **informational only** — they do not gate access in code or in rules.
