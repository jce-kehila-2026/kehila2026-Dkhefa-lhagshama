# Push for Fulfillment – Community Platform

A bilingual (HE / EN) digital platform for **עמותת דחיפה להגשמה** (Push for Fulfillment NGO), which supports the Ethiopian-Israeli community in Israel. The platform consolidates assistance-request intake and case management, a catalog of community answers (NGOs, initiatives, and public bodies), and a directory of community-owned businesses — all governed by an admin backend for approvals and impact reporting.

**Live app (staging):** https://push-for-fulfillment-staging.web.app

## Team

| Name | Role | GitHub |
|---|---|---|
| Abdullah Abu Lafi | Lead · UC-05 Admin Approval | [@abdullahabulafi](https://github.com/abdullahabulafi) |
| Muhammad Marmash | UC-01 Submit Request | [@MuhammadMarmash](https://github.com/MuhammadMarmash) |
| Mhammad Siag | UC-04 Internal Chat | [@mhammadsiag](https://github.com/mhammadsiag) |
| Hamza Karaky | UC-02 + UC-03 Directories | [@hamzakaraky](https://github.com/hamzakaraky) |

## Features

Beyond the five core use cases (UC-01..UC-05), the platform includes a volunteer operational hub and expanded admin operations:

- **Volunteer hub** (`/volunteer-hub`, role `volunteer`; admin is a superset) — dashboard, available request pool, my assigned requests, calendar/availability, and personal insights. Volunteers set their work-status, request category permissions, claim requests from a priority-sorted pool, edit urgency/deadline on assigned requests, mark requests done, and self-drop stuck requests with a report (which returns them to the pool flagged "previously taken").
- **Admin back office** — operational dashboard with KPIs and "needs attention" queues, approval queue, request management + assignment with a transparent **rule-based volunteer matcher**, volunteer roster, user/role management, chats oversight, directory CRUD, an admin-managed category taxonomy, and impact insights.
- **Public + UX** — bilingual home and community directory (businesses + nonprofits + partners), status-grouped my-requests with request↔chat shortcuts, friendly `REQ-####` request IDs, and a consent-close handshake.

## Tech Stack

- **Frontend:** React 18 + Next.js (Pages Router) + Tailwind CSS — `frontend/` → Firebase **Hosting**
- **Backend:** Node.js + Express + Firebase Admin SDK — `backend/` → Cloud **Functions** (2nd-gen function `api`, Node.js 22, `us-east1`)
- **Auth:** Firebase Auth (Email/Password) with role-based custom claims
- **Data:** Firestore (`us-east1`) + Firebase Storage (`us-east1`, private)
- **Hosting model:** one Firebase project. The browser calls `/api/**` on the **same origin**; Firebase Hosting rewrites it to the `api` Cloud Function (no CORS).

## Repo Layout

```
kehila2026-Dkhefa-lhagshama/
├── frontend/            # Next.js + Tailwind app (Firebase Hosting)
├── backend/             # Node.js + Express + Firebase Admin SDK (Cloud Functions `api`)
├── docs/                # Internal engineering docs
├── .github/workflows/   # CI (ci.yml) + Firebase deploy (deploy.yml)
├── firebase.json        # Firebase config (hosting + functions + firestore + storage)
├── .firebaserc          # Firebase project alias (default: push-for-fulfillment-staging)
├── firestore.rules      # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
└── storage.rules        # Firebase Storage security rules
```

## Firebase configuration (committed in this repo)

All Firebase backend configuration lives in version control so the project can be rebuilt and redeployed from a clone:

| File | Purpose |
|---|---|
| `firebase.json` | Created by `firebase init`. Points Hosting → `frontend/`, Functions → `backend/` (function `api`), and references the rules/indexes files below. Defines the `/api/** → api` rewrite. |
| `.firebaserc` | Project alias map. `default` = `push-for-fulfillment-staging`. |
| `firestore.rules` | Firestore security rules. |
| `firestore.indexes.json` | Firestore composite indexes (chat pagination, request lists, etc.). |
| `storage.rules` | Firebase Storage security rules (private; uploads served via short-lived signed URLs). |
| `frontend/src/lib/firebase.ts` | Web SDK initialization. Reads the public config (incl. `NEXT_PUBLIC_FIREBASE_API_KEY`) from environment variables — see `frontend/.env.example`. |
| `frontend/.env.example`, `backend/.env.example` | Templates listing every required environment variable. |

> **Secrets are never committed.** The backend service-account key (`backend/serviceAccountKey.json`), `.env`/`.env.local` files, and `*-firebase-adminsdk-*.json` are all gitignored. The Firebase Web `apiKey` is a public client identifier (not a secret) and is supplied through `NEXT_PUBLIC_FIREBASE_API_KEY`.

## Run from a clone

Assumes a Firebase project already exists (default: **push-for-fulfillment-staging**) with a Web App, Email/Password auth, Firestore and Storage enabled, and that you have its Web SDK config (including the **API key**) and a service-account key.

**Prerequisites:** Node.js 20+, npm, and (for deploys) the Firebase CLI (`npm i -g firebase-tools`).

```bash
git clone https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama.git
cd kehila2026-Dkhefa-lhagshama
```

**1. Frontend environment** — copy the template and fill in the Web SDK config:
```bash
cp frontend/.env.example frontend/.env.local
```
Set the `NEXT_PUBLIC_FIREBASE_*` values from Firebase Console → Project settings → Your apps → Web app → SDK config (this is where the **`NEXT_PUBLIC_FIREBASE_API_KEY`** comes from). For local development set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001`.

**2. Backend environment** — copy the template and add the service-account key:
```bash
cp backend/.env.example backend/.env
# Place the service-account JSON at backend/serviceAccountKey.json
# (Firebase Console → Project settings → Service accounts → Generate new private key)
# .env already points GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

**3. Install and run** (two terminals):
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
cd backend  && npm install && npm run dev   # http://localhost:3001
```

Open http://localhost:3000. Demo/test accounts are listed in [`TEST-ACCOUNTS.md`](TEST-ACCOUNTS.md).

## Deploy

The default deploy target is the **staging** project (`push-for-fulfillment-staging`, per `.firebaserc`). A single framework-aware deploy ships the whole stack.

**Manual (Firebase CLI):**
```bash
firebase login
firebase experiments:enable webframeworks
# everything: hosting + functions + firestore rules/indexes + storage rules
npx firebase deploy --project push-for-fulfillment-staging
```
See [`DEPLOY.md`](DEPLOY.md) for the full runbook, selective deploys, and log viewing.

**Automated (GitHub Actions):** `.github/workflows/deploy.yml` runs on push to `main` (and manual dispatch). It first runs a lint + build + test gate, then deploys Hosting + Functions + Firestore rules/indexes. Required repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON key of a service account with Firebase Hosting Admin, Cloud Functions Admin, Cloud Datastore Owner, and Service Account User roles. |
| `FIREBASE_PROJECT_ID` | `push-for-fulfillment-staging` |
| `NEXT_PUBLIC_API_BASE_URL` | empty / `/api` (the frontend calls the backend same-origin via the Hosting rewrite). |

`.github/workflows/ci.yml` runs lint + build + tests on pull requests.

## Non-Profit

- **Organization:** עמותת דחיפה להגשמה / Push for Fulfillment
- **Contact:** info@push4ful.org.il
- **Key deliverable:** Assistance-request intake + community answers catalog + business directory, with an admin back office for approvals and impact reporting.

## Wiki

Full documentation — overview, requirements, architecture, use cases, risks, test plan, and the **Client Handover & Installation Guide**:
https://github.com/jce-kehila-2026/kehila2026-Dkhefa-lhagshama/wiki

## License

MIT
