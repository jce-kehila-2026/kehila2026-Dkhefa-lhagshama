# Professor Feedback — Round 4 — Completion Report

**Date:** 2026-06-14
**Branch:** `feat/professor-feedback-round-4` (off `feat/npo-real-content`) — **107 commits, NOT pushed, NOT merged** (awaiting review, like prior rounds).
**Spec:** `docs/superpowers/specs/2026-06-14-professor-feedback-round-4-design.md`
**Plan:** `docs/superpowers/plans/2026-06-14-professor-feedback-round-4.md` (120 tasks)

Everything from the professor meeting is implemented and verified end-to-end in both Hebrew and English.

## What changed (10 workstreams)

- **WS-1 Home hero** — three weighted role buttons (Request Help / Volunteer / Staff login), role-aware via the destination login gates; help CTA reworded ("Request Help" / "בקשת עזרה"); a signed-in wrong-role user is redirected to their own home with a toast instead of a dead-end access-denied card.
- **WS-2 Less scrolling** — interior page editorial headers compressed via new `-compact` modifier classes (shared base classes untouched), double-padding seam removed, post-submit banners consolidated; cards/forms/board now sit near the top in HE and EN.
- **WS-3 Friendly request ID** — server-allocated `REQ-####` (`displayId`) via a Firestore counter transaction; the UUID stays the durable key; shown everywhere a request id appears (my-requests, chat list, chat window rail, admin chats); chats show the linked request's `REQ-####`. Idempotent backfill script for legacy requests.
- **WS-4 Admin dashboard** — actions-first layout (attention queue first/bold), every KPI tile is a link to its filtered list; new backend counts (`awaitingReviewRequests`, true `unassignedRequests`, pending directory approvals, today's new); deduped metrics; resilient to missing Firestore indexes.
- **WS-5 Admin requests list** — client-side search; new "Requester / From" and "Interested volunteer" columns (labelled, tooltipped, `data-label` for mobile); sortable headers with `aria-sort`; the volunteer name-vs-uid bug fixed (live name resolution + backfill script).
- **WS-6 Matching algorithm** — transparent, unit-tested, rule-based scorer (category fit, workload, day-aware availability, language) with reason chips; new optional `preferredLanguage` request field (he/am/en); `GET /api/admin/requests/:id/candidates`; ranked candidate cards replace the bare dropdown. No AI.
- **WS-7 Volunteer availability + calendar** — `availabilityWindows` (recurring weekly) + `availableAgainOn` on the volunteer doc; new `/volunteer-hub/calendar` page (month grid of assigned-request deadlines overlaid with availability, RTL-safe); availability editor; "unavailable" prompts an optional return date that auto-clears; admin sees it read-only.
- **WS-8 Volunteer dashboard declutter** — fewer cards; promoted assigned count / next deadline / availability; status links to the calendar.
- **WS-9 Admin volunteers + search** — volunteers list defaults to the Active tab (+`?tab=` deep-link); client-side search added to Users, Volunteers, and Directory (bilingual).
- **WS-10 Admin insights** — single-number cards merged into a compact KPI strip with new scalar metrics (total / open / closed-this-month / closure rate); charts grouped under headings with a promoted hero chart.

## Verification (the `/loop` "be 100% sure" pass)

- **Static, all green:** backend `type-check` clean; **backend Jest 47/47** (6 suites, incl. the matcher scorer, displayId counter/formatter, dashboard/insights aggregations); frontend `tsc` clean; `next build` 28 routes (incl. new `/volunteer-hub/calendar`, none dropped); **Firestore rules emulator 75/75**.
- **Adversarial review** of the full diff (6 dimensions, every finding independently refuted before acceptance): 11 confirmed → **9 distinct fixes applied** (1 major: matcher deadline-availability was weekday-blind; 8 minor: misleading "Low workload" chip, two KPI count/destination mismatches, post-submit UUID, two em-dashes, RTL calendar chevrons, chat-window displayId drop).
- **Browser E2E sweep, all roles HE+EN:** PASS_WITH_ISSUES → 2 issues found and fixed → **re-verified PASS**:
  1. `/api/admin/stats` 500 from a missing composite index — hardened so the endpoint returns 200 via a graceful fallback even without the index, and added the composite indexes to `firestore.indexes.json`.
  2. Deep-linked `?status=` filter not applied on first load — fixed so KPI-tile links land on the correctly-filtered list.
- Screenshots: `PROFESSOR-FEEDBACK-ROUND-4/e2e-screenshots/`.

## Human-only steps before the demo

1. **Deploy Firestore rules:** `firebase deploy --only firestore:rules` (new `counters/requests` deny rule).
2. **Deploy Firestore indexes (recommended):** `firebase deploy --only firestore:indexes` — makes the "today's new" count exact. The dashboard already works without it (graceful fallback to a created-today count), so this is not a hard blocker.
3. **Run the backfill scripts** (assign legacy data), each idempotent, human-run with `serviceAccountKey.json` + `.env` present:
   - `cd backend && npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfillDisplayId.ts`
   - `cd backend && npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfillAssignedNames.ts`
4. Decide on review/merge (not merged to `main` by this work).

## Notes

- New requests already get `REQ-0001`, `REQ-0002`, … from the live counter; the backfill is only for requests created before this round.
- The matcher is rule-based and explainable by design (no AI), per the project's documented MVP scope.
- Region-based matching remains out of scope (no backing data); the matcher uses category + workload + availability + language.
