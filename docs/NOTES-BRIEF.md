# Notes Brief — Brainstorming Input (11 notes)

**TL;DR**
1. **Security:** Only one real finding — Note 4 (`/volunteer` ungated mock signup) is **low** severity. Note 9 (chat ID in URL) is a **non-issue** — IDOR-safe, server-enforced. Note 1 has an **authz inconsistency** (Storage rules vs upload/read route role models) to reconcile if a "view docs" feature ships. No high/critical anywhere.
2. **Quick wins:** Notes 2 (dead "More" button), 3 (empty PageHeader band), 9 (cosmetic only), 5 (navbar UX shape), 10 (single hero image) are small/contained. **Substantial features:** Notes 1 (doc viewing), 6 (request lifecycle), 7 (admin insights), 8 (referrals), 11 (volunteer photo+name in chat) — all need new endpoints/schema/data plumbing.
3. **Dependencies:** Notes **6 + 7 + 8** all hinge on the request status/lifecycle model (done→review→close→archive, "referred" state, timestamped transitions for trends). Note **4** is the parent of **6/8/11** via the role model (stale claims, no RoleGate, mock VolunteerPage). Note **11** depends on first fixing the mock VolunteerPage from Note 4.

---

## Note 1 — Uploaded documents are write-only (nobody can view them after upload)
**Today:** Files POST through `backend/src/routes/uploads.ts` to Storage `requests/{id}/{file}`; a signed read URL is minted **once** at upload (1h TTL) and discarded. No backend endpoint re-mints a URL, and `AdminRequestDetailPage.tsx` renders zero attachments — `MyRequestsPage.tsx` shows only a count.
**Gap/Risk:** Primary = functional: ID scans + support docs are effectively invisible after upload. **Authz inconsistency (not exploitable today):** `storage.rules` grants read to owner+admin only, but `uploads.ts` and the request-read route grant owner/handler/assignedVolunteer/admin — pick ONE model before building viewing. PII: ID doc is national-ID; any signed URL is a bearer link for its TTL.
**Decisions:**
- Who views the ID doc — admin only, or assigned volunteer/handler too? (reconcile `storage.rules` with route model)
- View mechanism: new backend `GET /api/requests/:id/attachments/:name` that re-mints a short-lived URL (recommended, keeps Storage private) vs client-SDK direct reads
- Introduce an `attachments` Firestore collection (filename/type/size/uploadedBy) vs keep bare path strings on the request doc
- Signed-URL TTL for active review; audit-log ID-doc access?
- Treat ID doc as more sensitive (admin-only) than support doc?

## Note 2 — Directory "More Details" button is dead
**Today:** Business and answer cards' "More" button has no `onClick` (`DirectoryPage.tsx:567`, `:632`). Only working action is the business `tel:` link; answer cards have no contact action.
**Gap/Risk:** None (cosmetic). Data limits the options: `/api/businesses` has **no website/email/address/hours**; answer cards already render the full body, so there's no hidden detail to reveal.
**Decisions:**
- Modal vs detail route (`/directory/business/[id]` — doesn't exist) vs in-place expand?
- Businesses: add `website`/email/address/hours to schema + form, or drop external-link idea?
- NGO answers: since body is already shown, make "More" a Contact / "Start a request" CTA instead?
- Or just remove "More" on businesses and promote the phone link?

## Note 3 — Empty/redundant top band (PageHeader)
**Today:** `PageHeader.tsx` renders ~64px+heading+32px+2rem of tinted empty space on Volunteer, Requests (x2), ChatList, ChatWindow (x2), MyRequests. `ChatWindowPage.tsx:219` sets eyebrow == title (both `c.windowTitle`) — the clearest redundancy.
**Gap/Risk:** None (cosmetic). Shared component — any padding/background change hits all 7 sites including MyRequests (which uses the children slot). `center=true` default looks off on form pages.
**Decisions:**
- Reduce padding globally vs only these pages?
- Remove PageHeader from these screens and build inline editorial headers like DirectoryPage does?
- Or fill the band with useful context (step indicator for Requests, unread counts for Chats, volunteer count)?
- Fix `ChatWindowPage` duplicated eyebrow==title regardless
- Switch center → start alignment for form pages?

## Note 4 — Volunteer sees the volunteer SIGN-UP page (ungated mock form) — SECURITY: LOW
**Today:** Navbar "volunteers" link has no role filter (`Navbar.tsx:57`); `/volunteer` → `VolunteerPage.tsx` has no `useAuth`/gate and unconditionally shows a "Sign up" form. That form is **mock** — `handleSubmit` writes to in-memory AppContext, never hits `POST /api/volunteers/apply`. The real flow lives in `RegisterPage.tsx` (Firebase create + apply + thanks). Two competing, disconnected signup UIs.
**Gap/Risk:** **Low security.** No RoleGate exists for non-admin pages (only `AdminGate`). Mock form silently loses submissions. Plus the role-model issue underlying 6/8/11: claims-based role only refreshes on force-refresh/re-login (stale `beneficiary` after promotion); `requireRole` is exact-match (admin doesn't pass `requireRole('volunteer')`).
**Decisions:**
- What should an already-volunteer see at `/volunteer` — roster only / redirect to a volunteer dashboard / remove the page entirely?
- One signup location: delete the mock VolunteerPage form and keep only RegisterPage's flow, or wire VolunteerPage to the real backend?
- Build a reusable non-admin `RoleGate` (like `AdminGate`)?
- Post-login home for existing volunteers — dashboard, or work out of `/chats` + assigned requests? (affects 6/8/11)
- Should the navbar link label/target differ by role?

## Note 5 — Language toggle is a 2-state flip; account is a click-only chip
**Today:** `LanguageContext` is a boolean `'he'|'en'` flip; navbar pill shows the OTHER language's code (anti-pattern). Account "chip" is a plain `<Link href="/my-requests">`; Sign Out + Submit CTA are separate sibling buttons — no dropdown.
**Gap/Risk:** None (cosmetic/UX). >2 languages is explicitly OUT OF SCOPE per CLAUDE.md — but the *affordance* (toggle vs menu) is what the note objects to. Navbar already width-tight. No accessible disclosure pattern.
**Decisions:**
- Convert language toggle → dropdown showing CURRENT language + checkmark (keep boolean or refactor to `setLang(code)`)?
- Generalize the model now (array of `{code,label,dir}`) or keep 2 langs but present as a menu?
- Add a real account dropdown (My Requests / Admin if admin / Sign Out) with `aria-expanded`?
- Sign Out inside the menu or stay visible?
- Keep Submit Request CTA outside the menu as primary action?
- Mirror menus in mobile hamburger or keep flat list?

## Note 6 — Volunteer-done → admin-review → close → archive lifecycle does not exist
**Today:** Status enum is `pending|in_progress|resolved|rejected|closed` (`requests.ts:29`); forward-only (index-based, 409 on backward), **admin-only** writes via `POST /api/admin/requests/:id/status`. No `done`/`archived` state, no volunteer-writable transition, no "my assigned requests" view, no review queue for requests (AdminApprovals covers only catalog entities). Frontend `RequestStatus` type is stale/wrong.
**Gap/Risk:** None security. To support the flow: new volunteer-scoped "done" endpoint (gated to handler/assignedVolunteer), a distinct awaiting-review state, an archive mechanism + stats bucket. Forward-only index model **conflicts** with any admin reopen/send-back — would need an explicit transition map. `requestEvents` already supports custom status events (cheap).
**Decisions:**
- New `done`/`awaiting_review` state vs repurpose `resolved`?
- Define full lifecycle + legal transitions; where do `rejected`/`resolved` fit; allow backward (reopen)? → keep index model or switch to a transition map
- Who sets each state — `done` requires assigned handler; `close`/`archive` admin-only? New volunteer-scoped endpoint vs rules carve-out?
- `archived` = status value, boolean flag, or separate collection? (affects stats + filters)
- Dedicated "requests awaiting close" admin queue/filter?
- Beneficiary visibility of closed/archived; interaction with ratings (currently needs `resolved`)?
- Reconcile stale frontend `RequestStatus` type

## Note 7 — Admin insights are 6 flat counts; no charts, time-series, or archive view
**Today:** `AdminDashboard.tsx` shows exactly 6 real `count()` metrics from `/api/admin/stats` + 3 nav shortcuts. `resolvedRequests`/`totalRequests` are returned but unused. `mockAnalyticsMonths/mockCategoryStats/mockCityStats` are dead (never wired). No chart library installed; no trend/category/city/per-volunteer/SLA metrics; rejected/closed never surfaced.
**Gap/Risk:** None security. Insights are shallow. Real trends/avg-resolution-time **require timestamped status transitions** — depends on Note 6's lifecycle/archive (schema decision → touch `generate_mdj.py` first). Dashboard treats missing keys as 0, so a field rename silently shows 0. Verify `volunteers`/`volunteerApplications` collection names match what's written.
**Decisions:**
- Add an Insights view with real charts (install recharts vs hand-roll SVG)?
- Source for trend/avg-resolution: add status-history timestamps, derive from auditLogs, or build on Note-6 archive? (schema)
- Surface rejected/closed counts? Surface lifetime `totalRequests`?
- Confirm collection-name match to avoid silent zeros
- Per-volunteer workload metric in scope for demo?

## Note 8 — Referrals to partner organizations do not exist in code
**Today:** No `referrals` collection, route, schema, or UI — zero code hits for "referral". Only traces: FAQ marketing copy promising referrals (`mockData.ts:698`) and a fake stat `referralsToNGOs: 340`. `organizations` collection has rules but no read API/data; `answers` (UC-02) is the live partner catalog but isn't linked to any request.
**Gap/Risk:** None security. **Customer-expectation gap:** FAQ promises this to users while nothing implements it. Building it needs a data model, a target entity decision, an admin endpoint, UI both sides, and likely a new `referred` status (collides with Note 6 lifecycle).
**Decisions:**
- Referral target: `organizations` (rules, no API/data) vs live `answers` catalog vs free-text external partner (name+URL)?
- Admin-only (consistent with other request mutations) or assigned volunteer too? Endpoint at `/api/admin/requests/:id/refer`?
- New `referred` status? Terminal like `closed`? Counts as helped/archived? (ties to Note 6)
- Data shape: dedicated `referrals` collection (new rules + indexes) vs embedded field on request?
- How is the beneficiary informed (timeline event vs email)? What partner details exposed via `/api/requests/mine`?
- Seed `organizations` + build public `/api/organizations` directory first, or is `/api/answers` enough?
- Replace fake `referralsToNGOs` stat with a real count once live?

## Note 9 — Chat ID in URL — SECURITY: NONE (informational)
**Today:** `/chats/[id]` uses a random Firestore auto-id; reads gated by `firestore.rules` participant check, writes only via authenticated Express `POST /api/chats/:id/messages` with 403 unless participant; direct client writes blocked (`if false`).
**Gap/Risk:** **No authorization gap — textbook IDOR-safe.** Knowing/guessing an id grants nothing. Minor: raw chatId shown in header (no PII, harmless); confirm the messages composite index (chatId + timestamp asc) is deployed so missing-index isn't confused with permission-denied.
**Decisions:**
- Hide the raw chatId from the header (cosmetic) or leave it for the demo?
- Clearer "you don't have access to this conversation" message vs current neutral empty state?
- Confirm composite index deployed

## Note 10 — Hero is a 3-image montage; moving to a single background image
**Today:** Hero is a 2-col grid; left column `.hero-montage` holds 3 `AssetImage` slots (A/B/C from manifest); `.hero-bold` background is gradients only; copy is dark `--ink` on light wash.
**Gap/Risk:** None. Tradeoffs: CSS `background-image` loses alt/manifest/lazy-load/fallback (a11y regression for a meaningful image) vs absolutely-positioned `AssetImage` keeps all of it (recommended). Text legibility over a photo needs a scrim (reuse `.story-panel-scrim` precedent) + recoloring inline stats. RTL bloom flips need to track the new layout.
**Decisions:**
- Keep 2-col with image on one side, or full-bleed with copy overlaid?
- CSS `background-image` vs absolutely-positioned `<AssetImage>` (recommended)?
- If full-bleed: scrim treatment + does body copy flip to `--cream` (cascades to stat strip)?
- New `heroBackground` slot vs reuse existing `hero` slot; aspect/focal point?
- Remove `heroMontageB/C` slots or keep for reuse?
- RTL: copy/overlay side + mirror-safe focal point

## Note 11 — Volunteer photo + name in chat: all data plumbing is missing
**Today:** No `photoURL`/avatar field on `users`, `volunteers`, or `volunteerApplications` anywhere. Messages store only `chatId/senderId/content/timestamp/status` — chat UI renders content+timestamp only, no name/avatar (`ChatWindowPage.tsx:353`). The only upload path is request-scoped (`requests/{id}/`). VolunteerPage form is mock (Note 4), so even text fields never reach the backend.
**Gap/Risk:** None security (consent/PII consideration for storing photos). Needs: a photo field + a generic avatar upload path/endpoint/Storage rule + either denormalized senderName/senderPhoto on messages or a participant→profile lookup. Blocked-on Note 4: fix the disconnected VolunteerPage first.
**Decisions:**
- Where does the photo live: `volunteers/{uid}`, `users/{uid}` (reusable), or both?
- Chat identity resolution: denormalize senderName/senderPhoto at write time (simple, stale on edit) vs fetch participant profiles once?
- Photo for all participants or only volunteers?
- Upload mechanism: generalize request-scoped upload into `avatars/{uid}` (new rule, public-ish read?) vs dedicated endpoint; public read vs signed URL?
- First rewire VolunteerPage → `POST /api/volunteers/apply` with aligned fields (Note 4)?
- Consent/PII: explicit consent to store/display photo; who can see it (public directory vs only inside assigned chat)?
