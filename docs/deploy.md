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

## Backend

**Decision pending — Cloud Run or Vercel.** The deploy workflow has both
options scaffolded (commented out) under the `backend` job, guarded by
`if: false`. Once the target is chosen, uncomment the relevant block, add its
secrets, and remove the guard. See `.github/workflows/deploy.yml`.

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
| `FIREBASE_SERVICE_ACCOUNT` | frontend deploy | SA JSON: Hosting Admin + Cloud Functions Admin + Service Account User |
| `FIREBASE_PROJECT_ID` | frontend deploy | e.g. `push-for-fulfillment-staging` (see `.firebaserc`) |
| `NEXT_PUBLIC_API_BASE_URL` | frontend build | public backend URL |
| `GCP_SA_KEY` / `VERCEL_TOKEN` | backend deploy | only once a backend target is chosen |
