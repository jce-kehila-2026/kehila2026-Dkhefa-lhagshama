# Deploy

CI deploys run from `.github/workflows/deploy.yml` on push to `main`
(or manual `workflow_dispatch`). This page documents the manual equivalent.

## Frontend (Firebase Hosting, framework-aware)

The frontend is a Next.js app with SSR / API routes (no `output: 'export'`),
so we use Firebase's framework-aware hosting. `firebase.json` `hosting.source`
points at `frontend/`, and the CLI builds + deploys it (Hosting CDN + Cloud
Functions for SSR).

```
firebase experiments:enable webframeworks
firebase deploy --only hosting
```

> If the team later switches the frontend to a fully static export
> (add `output: 'export'` in `frontend/next.config.js`), change `firebase.json`
> hosting back to `"public": "frontend/out"` and deploy `frontend/out`.

> Build note: Next 16 uses Turbopack for `next build`. Turbopack panics if
> `frontend/node_modules` is a **symlink that points outside the project root**
> (`Symlink [project]/node_modules is invalid`). CI installs deps with
> `npm ci`, which creates a real directory, so builds succeed there. Only some
> local git-worktree setups (where node_modules is shared via symlink) hit this;
> run a plain `npm install` inside `frontend/` to get a real node_modules.

## Backend (Express → Cloud Function `api`)

**This is decided and live** (the earlier "Cloud Run vs Vercel — pending" note
was stale). The Express backend runs as a **2nd-gen Cloud Function** named `api`
(`backend/src/function.ts` wraps the Express app in `onRequest`). `firebase.json`
declares a `functions` codebase with `source: backend`, `runtime: nodejs22`, and
a `predeploy` that builds the backend (`tsc && tsc-alias`). The browser reaches
it **same-origin** through the Hosting rewrite `"/api/** -> function api"`, so
there is no separate backend URL and no CORS in production.

```
# build runs automatically via firebase.json functions.predeploy
firebase deploy --only functions
```

Because frontend (Hosting), backend (Functions) and security rules all live on
the one Firebase project, CI deploys them together:

```
firebase deploy --only hosting,functions,firestore:rules,firestore:indexes
```

## Firestore rules / indexes / storage

```
firebase deploy --only firestore:rules,firestore:indexes,storage
```

> Note: rules **unit tests** run against `firebase.emulators.json` (a
> hosting-free copy of the config) so the emulator does not try to build the
> Next.js app. Deploys use the full `firebase.json`. See `tests/README.md`.

## Required CI secrets

| Secret | Used by | Notes |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | deploy | SA JSON: Hosting Admin + Cloud Functions Admin + Cloud Datastore Owner (rules/indexes) + Service Account User |
| `FIREBASE_PROJECT_ID` | deploy | e.g. `push-for-fulfillment-staging` (see `.firebaserc`) |
| `NEXT_PUBLIC_API_BASE_URL` | frontend build | empty/relative `/api` for the same-origin Hosting rewrite |
