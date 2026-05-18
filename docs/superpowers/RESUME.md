# Session Resume — Frontend Redesign

**Last touched:** 2026-05-19
**Branch:** `redesign/frontend-brand-refresh` (checked out, uncommitted changes)

## Where we are

1. ✅ Brainstorming complete. Spec written + self-reviewed + approved by user.
2. ✅ Spec lives at `docs/superpowers/specs/2026-05-18-frontend-redesign-design.md`.
3. 🟡 **In progress: writing-plans skill.** Was about to write `docs/superpowers/plans/2026-05-18-frontend-redesign.md` when the user lost internet.

## Important late-stage discovery (NOT YET REFLECTED IN SPEC)

The bulk of the existing styling lives in **`frontend/src/styles/globals.css`** (~560 lines of `.btn`, `.btn-primary`, `.card`, `.badge-*`, `.navbar`, `.modal-overlay`, `.step-dot`, `.filter-chip`, `.upload-area`, `.form-input`, etc.) — NOT in Tailwind utilities scattered across JSX.

This changes implementation strategy:
- **Phase 1 is mostly a `globals.css` rewrite** (swap CSS custom properties `--navy` → `--ink`, `--gold` → `--ember`, etc., and restyle all the named classes).
- The Tailwind config update is secondary (mostly for the few JSX files that DO use utility colors).
- **Do NOT create new `components/ui/` primitives** as the spec mentioned. The existing class system (`.btn-primary`, `.card`, `.badge-*`, `.form-input`) already plays that role — restyle them in place. This skips an entire duplication round.
- Spec §4 (Component Primitives table) should be read as "restyle these existing classes" not "create new React components".
- This makes parallelism between phases 3/4/5 even cleaner — they only touch JSX for editorial structure additions (eyebrows, serif H1 with ember `<em>` words), not styling.

## What the plan should look like (outline)

```
Phase 1 — Foundations (single agent, no parallelism)
  1.1 Rewrite globals.css :root tokens (navy/gold → sky/ink/cream/ember/paper)
  1.2 Restyle all globals.css class definitions to match new palette
  1.3 Update tailwind.config.js colors (remove navy/gold; add sky/ink/cream/ember)
  1.4 Add eyebrow + section-header utility classes to globals.css
  1.5 Build + smoke (HE+EN) + commit

Phase 2 — Global chrome (sequential, depends on Phase 1)
  2.1 Navbar JSX touch-up (logo + eyebrow)
  2.2 Footer JSX touch-up
  2.3 PageHeader add eyebrow/serif H1 split
  2.4 Build + commit

Phase 3 — Marketing screens (parallel subagents)
  3.1 HomePage hero with logo + eyebrow + ember em
  3.2 LoginPage two-column layout
  3.3 RegisterPage two-column layout

Phase 4 — UC-01 critical path (single agent, careful)
  4.1 RequestsPage layout + StepIndicator restyle
  4.2 MyRequestsPage editorial list
  4.3 UploadArea restyle
  4.4 Full HE+EN submit smoke

Phase 5 — Directory + Volunteer (parallel subagents)
  5.1 DirectoryPage + Pagination
  5.2 VolunteerPage + VolunteerCard

Phase 6 — View Transitions (single agent)
  6.1 Wire ViewTransition wrapper into _app.tsx
  6.2 Route-change transitions
  6.3 Filter-reorder list transitions

Phase 7 — Cleanup + a11y (single agent)
  7.1 Delete Formelements.jsx, Stepindicator.jsx duplicates
  7.2 Lighthouse a11y on Home/Login/Requests/Directory
  7.3 LCP pass via chrome-devtools:debug-optimize-lcp
  7.4 Final rebase on main, push, open PR
```

Parallelism candidates for `dispatching-parallel-agents`: Phase 3 (3 agents), Phase 5 (2 agents). Everything else is sequential because it touches shared files (globals.css, tailwind.config.js, _app.tsx).

## To resume next session

Tell Claude:
> "Continue the frontend redesign. Resume from RESUME.md at docs/superpowers/RESUME.md. Pick up writing-plans where it stopped, taking into account the globals.css discovery noted there."

Branch should already be `redesign/frontend-brand-refresh`. If not:
```
cd /home/muhammad/college/עמותה/sem2/github/main_github/kehila2026-Dkhefa-lhagshama
git checkout redesign/frontend-brand-refresh
```

Uncommitted state expected:
- `.gitignore` — appended `.superpowers/`
- `docs/superpowers/specs/2026-05-18-frontend-redesign-design.md` — the approved spec
- `docs/superpowers/RESUME.md` — this file
- `.superpowers/brainstorm/...` — brainstorm session artifacts (ignored)

## User preferences to honor

- **Skip visual A/B/C option screens.** Auto-pick recommended choices. See `feedback_skip_visual_options.md` in memory.
- **Use subagents to make things faster** — applies to the writing-plans → executing-plans handoff. Subagent-driven-development is the chosen execution path.
- **Never touch main.** All work on this branch.
- **Use all installed frontend skills' principles** — emil-design-eng, vercel-composition-patterns, vercel-react-best-practices, vercel-react-view-transitions, web-design-guidelines, chrome-devtools:a11y-debugging, debug-optimize-lcp.

## Task list snapshot

- #5 explore frontend + locate logo — completed
- #6 offer visual companion — completed
- #7 clarifying questions — completed
- #8 propose approaches — completed
- #9 present design + section approval — completed
- #10 write spec — completed
- #11 spec self-review — completed
- #12 user reviews spec — completed (approved)
- #13 hand off to writing-plans — in_progress (interrupted)

Next active task on resume: continue #13 → write the plan document.
