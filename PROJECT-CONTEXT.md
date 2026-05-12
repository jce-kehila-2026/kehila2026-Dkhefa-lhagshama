# Project Context

Onboarding doc for the **Push for Fulfillment – Community Platform**. Read this first if you are new to the project or returning after a break. Target read time: under one minute.

## Mission

A bilingual (HE / EN) digital platform for **עמותת דחיפה להגשמה** (the "Push for Fulfillment" NGO), which supports the Ethiopian-Israeli community in Israel.

The platform aggregates three things in one place:

1. The NGO's own assistance-request intake and case management.
2. A catalog of community **answers** — NGOs, initiatives, public bodies, and the concrete offerings they provide.
3. A directory of community-owned **businesses**.

An admin backend governs approvals and impact reporting.

## Course context

University capstone project, **Semester 2 of 2**. The professor grades the entire semester and weighs **customer satisfaction** alongside code and documentation.

End-of-semester deliverable: a **fully working end-to-end application + complete wiki documentation**.

### Confirmed decisions with the professor

- Firebase (Auth + Firestore + Storage) is approved as the backend infrastructure.
- All 5 use cases (UC-01..UC-05) must be **live** in the end-of-semester demo — none mocked.
- The wiki **Test Plan** must be filled by **24 May 2026** (hard deadline).
- The demo must work in **both Hebrew and English** (HE / EN switcher must be functional).
- The team is expected to deliver strongly across **all aspects** (code, docs, customer satisfaction). No prioritization shortcut.

## Team

Four members:

| Member | GitHub | Vertical-slice ownership |
|---|---|---|
| Abdullah Abu Lafi (lead) | `abdullahabulafi` | UC-05 Admin Approval |
| Muhammad Marmash | `MuhammadMarmash` | UC-01 Submit Request |
| Mhammad Siag | `mhammadsiag` | UC-04 Internal Chat |
| Hamza Karaky | `hamzakaraky` | UC-02 + UC-03 Directories |

Cross-cutting work (auth, taxonomy seed, deploy, CI) is split as smaller side-issues.

## Repo layout

```
kehila2026-Dkhefa-lhagshama/
├── frontend/                  # Next.js (Pages Router) + Tailwind app
├── backend/                   # Node.js + Express + Firebase Admin SDK
├── .github/                   # PR template, Actions workflows (coming)
├── docs/                      # Internal engineering docs
├── firebase.json              # Firestore + Storage + Hosting config
├── .firebaserc                # Firebase project-id map
├── firestore.rules            # Firestore security rules (deny-all start)
├── storage.rules              # Storage security rules (deny-all start)
└── PROJECT-CONTEXT.md         # This file
```

## Tech stack

- **Frontend:** React 18 + **Next.js (Pages Router)** + Tailwind CSS + custom `LanguageContext` for HE / EN + Lucide icons. Lives in `frontend/`.
- **Backend:** **Node.js + Express + Firebase Admin SDK**. Lives in `backend/`. The frontend talks to the backend over HTTP via the `NEXT_PUBLIC_API_BASE_URL` env var.
- **Auth:** Firebase Auth (Email/Password) with custom claims for roles (`beneficiary | businessOwner | volunteer | admin`).
- **Data:** Firestore in `europe-west2` region.
- **File storage:** Firebase Storage (deferred until UC-01 file uploads land — requires Blaze plan upgrade).
- **Deploy target:** Firebase Hosting for the frontend; Cloud Run or Vercel for the backend (decision in Week 5).
- **Testing:** Jest / Vitest for unit tests; `@firebase/rules-unit-testing` for Firestore rules; Playwright optional for E2E.

## Architecture summary

3-tier (Presentation / Logic / Data). 12 domain entities:

- `users`, `requests`, `referrals`, `organizations`, `answers`, `businesses`, `chats`, `messages`, `attachments`, `auditLogs`, `categories`, `regions`.

Smart-routing / AI features are intentionally **out of MVP scope** because of the documented scope-creep risk (wiki Risk #1).

Architecture diagram + class diagram live on the wiki (Architecture & Design page). Source `.mdj` files are in `sem2/` (StarUML), regenerated from `sem2/generate_mdj.py`.

## Conventions

- **Branches:** `feat/<area>-<short>`, `fix/<area>-<short>`, `docs/<page>`, `chore/<short>`.
- **Commits:** imperative mood ("add request form", not "added"). Reference issues with `Closes #N`.
- **Pull requests:** require **1 reviewer**. `main` is protected; no direct pushes or force-pushes. Use the PR template at `.github/pull_request_template.md`.
- **Issues:** every PR closes an issue. Labels: priority (`P0/P1/P2`), area (`frontend/backend/docs/infra/process/security`), use case (`UC-01..UC-05`).
- **Wiki pages** are the source of truth for project-level documentation (overview, requirements, architecture, use cases, risks, test plan). They follow a consistent structure: H1 title + intro + H2 sections.
- **Diagrams** are generated from `sem2/generate_mdj.py` for architecture + class diagrams. Never hand-edit the `.mdj` files. Use-case diagram is hand-drawn in StarUML.
- **HE / EN strings** live in `frontend/src/contexts/LanguageContext` (or its eventual location). Every visible string goes through it.
- **Daily standup** in the team group chat by 9:00 AM each weekday: yesterday / today / blocked.
- **Weekly sync** Sundays — 30 minutes — walk the GitHub project board.
- **Customer cadence:** bi-weekly NGO check-in (Abdullah).

### Security conventions

- Firebase service-account JSON **never** in git (`.gitignore` covers it). Each developer keeps a local copy in a folder outside the repo.
- Firestore rules deny by default; explicit per-collection allow rules.
- All Firestore writes that need server trust go through the Express backend (Admin SDK). Client SDK is read-mostly + auth-only writes.

## Out of scope (hard NO until further notice)

- Native mobile app (iOS / Android).
- Smart-routing / AI features beyond simple If-Then suggestions.
- Payments / donations processing.
- Multilingual support beyond Hebrew and English.
- Deep integrations with external government systems or third-party NGO systems.

## References

- **Wiki:** https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki
  - [Project Overview](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/Project%E2%80%90Overview)
  - [System Requirements](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/System%E2%80%90Requirements)
  - [Architecture & Design](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/Architecture%E2%80%90%26%E2%80%90Design)
  - [Use Case Documentation](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/Use%E2%80%90Case%E2%80%90Documentation)
  - [Risk Assessment](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/Risk%E2%80%90Assessment)
  - [Test Plan](https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki/Test%E2%80%90Plan)
- **Issues:** https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/issues
- **Milestones:** https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/milestones

## Things to ask the team before changing

- Stack changes (adding a framework, swapping Firebase, etc.).
- Schema changes — regenerate diagrams, update the wiki Class Diagram embed, then update Firestore rules to match.
- New risks — append to wiki Risk-Assessment page; do not edit existing rows.
- Scope expansion past the MVP defined in the wiki Project Overview.
