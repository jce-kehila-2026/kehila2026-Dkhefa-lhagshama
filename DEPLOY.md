# Deployment & Logs

Everything runs in **one Firebase project** (`push-for-fulfillment-staging`). Frontend, backend, database, auth, and storage are all Firebase.

| Piece | Where it runs | URL / location |
|---|---|---|
| Frontend (Next.js) | Firebase **Hosting** | https://push-for-fulfillment-staging.web.app |
| Backend (Express API) | **Cloud Functions** (2nd gen, `api`, region `us-east1`) | reached at `…/api/**` via a Hosting rewrite |
| Database | Firestore | — |
| Auth | Firebase Auth | — |
| File storage | Firebase Storage | — |

The browser calls `/api/...` on the **same origin** as the site; Firebase Hosting rewrites `/api/**` to the `api` Cloud Function (`firebase.json` → `hosting.rewrites`). No CORS, one URL.

## Live URL

**https://push-for-fulfillment-staging.web.app** (also `.firebaseapp.com`)

## How to deploy

From the repo root (`kehila2026-Dkhefa-lhagshama/`):

```bash
# Backend only (Express → Cloud Function). Builds via the predeploy hook.
npx firebase deploy --only functions --project push-for-fulfillment-staging

# Frontend only (Next.js → Hosting).
npx firebase deploy --only hosting --project push-for-fulfillment-staging

# Everything (functions + hosting + firestore rules/indexes + storage rules)
npx firebase deploy --project push-for-fulfillment-staging
```

Prerequisites: Firebase CLI logged in (`firebase login`) with access to the project; the project is on the **Blaze** plan (required for Cloud Functions); the `webframeworks` experiment is enabled (`firebase experiments:enable webframeworks`).

## How to read the logs  ← (what to watch when something breaks)

**Backend (Cloud Function `api`) — this is where API errors show up:**

```bash
# Tail recent backend logs from the terminal
npx firebase functions:log --only api --project push-for-fulfillment-staging
```

Or in the browser (nicer, real-time, filterable):
- **Firebase Console** → Functions → `api` → **Logs** tab
  https://console.firebase.google.com/project/push-for-fulfillment-staging/functions/logs
- **Google Cloud Logging** (full power, search/filter by severity):
  https://console.cloud.google.com/logs/query?project=push-for-fulfillment-staging
  Filter: `resource.type="cloud_run_revision" resource.labels.service_name="api"`

Every `console.log` / `console.error` in the backend lands here, plus uncaught errors and request crashes. This is the place to look when a friend/NPO user reports "something went wrong."

**Frontend (Hosting):** it's a static client app, so most issues are visible in the **browser DevTools console** (F12). Hosting itself only has CDN request logs (Firebase Console → Hosting), which rarely matter for debugging app behavior.

**Auth / Firestore:** sign-in issues → Firebase Console → Authentication; permission-denied on data → Firestore rules (Console → Firestore → Rules) and the function logs (the backend uses the Admin SDK, which bypasses rules, so most data errors surface as function logs).

## Test accounts (password `Test1234!`)

`e2e.admin@pff.test` (admin), `e2e.volunteer@pff.test`, `e2e.bene@pff.test`, `e2e.owner@pff.test`,
plus seeded demo logins `demo.vol1@pff.test`, `demo.vol2@pff.test`, `demo.bene1@pff.test`.

## How it's wired (for maintainers)

- **`backend/src/app.ts`** — the Express app (no `listen()`). Shared by both entrypoints.
- **`backend/src/index.ts`** — local/standalone runner (`app.listen`), used by `npm run dev`.
- **`backend/src/function.ts`** — Cloud Functions entry: `export const api = onRequest({ invoker: 'public' }, app)`.
- **`backend/package.json`** — `build` is `tsc && tsc-alias` (tsc-alias rewrites the `@/` path aliases to relative paths so the compiled `dist/` runs under plain `node`); `main` is `dist/function.js`.
- **Credentials:** the function uses the runtime service account's Application Default Credentials — no key file is shipped. `firebaseAdmin.ts` drops `GOOGLE_APPLICATION_CREDENTIALS` if the file is missing (so a stray local value can't break the cloud boot).
- **`firebase.json`** — `functions` codebase `api` (source `backend`, runtime `nodejs20`) + `hosting` with the `/api/**` → function rewrite and rewrites for the three client-rendered dynamic routes (`/chats/*`, `/admin/requests/*`, `/admin/volunteers/*`) so deep-links/refreshes resolve.
- **`frontend/.env.production.local`** — sets `NEXT_PUBLIC_API_BASE_URL=` (empty → relative `/api`) for production builds.
- **Frontend env files are gitignored** (`.env*` except `.env.example`). `.env.production` is **no longer tracked** — its `NEXT_PUBLIC_*` values are public client config, but env files don't belong in git. A fresh clone/CI build supplies them via a local `.env.production.local` or CI env vars; `frontend/.env.example` documents every key.

## Notes

- `PORT` must NOT be set in `backend/.env` — Cloud Functions reserves it and refuses to deploy otherwise. Local dev defaults to 3001.
- Node 20 runtime is deprecated by Google (decommission 2026-10-30); bump the `runtime` in `firebase.json` and `engines` before then.
- First-ever functions deploy enables several Google Cloud APIs and may fail once on a build-service-account permission race — just re-run the deploy.
- This deploys to **staging** (the only project). There is no separate production project.
