# Backend — Push for Fulfillment Community Platform

Express + Firebase Admin SDK service. Hosts the team's main API; the Next.js frontend in `../frontend/` calls it over HTTP.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 4 + TypeScript
- **Auth:** Firebase Auth ID-token verification via Firebase Admin SDK
- **Data:** Firestore via Firebase Admin SDK
- **Validation:** `zod`
- **Lint:** ESLint + `@typescript-eslint`
- **Dev runner:** `nodemon` + `ts-node`

## Folder layout

```
backend/
├── src/
│   ├── index.ts              # Express bootstrap, CORS, route mounts
│   ├── lib/
│   │   ├── firebaseAdmin.ts  # Admin SDK init + db()/auth()/storage() handles
│   │   └── audit.ts          # Audit-log helper (UC-05 mitigations)
│   ├── middleware/
│   │   └── auth.ts           # ID-token verify, requireRole helper
│   └── routes/               # one file per UC, mounted in index.ts
├── package.json
├── tsconfig.json
├── nodemon.json
├── .eslintrc.json
└── .env.example              # copy to .env and fill in
```

## First-time setup

1. Create the Firebase project (see `docs/2-day-sprint.md` Day 1 in the meeting/sprint docs). Generate a service-account JSON.
2. Save the service-account JSON locally as `backend/serviceAccountKey.json`. **Do not commit it.** It's already covered by the repo's `.gitignore`.
3. Copy env file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` if you need to change defaults (port, frontend origin, credentials path).
4. Install dependencies:
   ```bash
   npm install
   ```

## Run

```bash
npm run dev
```

Starts on `http://localhost:3001` with hot-reload via nodemon. Sanity check:

```bash
curl http://localhost:3001/health
# → {"ok":true,"service":"push-for-fulfillment-backend"}
```

## Build for deploy

```bash
npm run build
npm start
```

Builds to `dist/` and runs the compiled output.

## Lint

```bash
npm run lint        # check
npm run lint:fix    # auto-fix
npm run type-check  # tsc --noEmit
```

## Adding a new UC route

For each vertical-slice UC owner, the workflow is:

1. Create `src/routes/<uc>.ts` exporting an Express router.
2. Use the `authenticate` middleware on protected routes.
3. Use `requireRole('admin')` (or other role) for role-gated routes.
4. Validate input with `zod` schemas at the top of the route file.
5. Use `db()` from `lib/firebaseAdmin` for Firestore writes.
6. Use `writeAuditLog(...)` from `lib/audit` for any state-changing admin action.
7. Mount the new router in `src/index.ts`.

See `docs/patterns.md` (lands when UC-01 is complete) for a copy-pasteable pattern.

## Vertical-slice ownership

| UC | Route prefix | Owner |
|---|---|---|
| UC-01 Submit Request | `/api/requests` | Muhammad Marmash |
| UC-02 Community Answers | `/api/answers` | Hamza karaky |
| UC-03 Businesses Directory | `/api/businesses` | Hamza karaky |
| UC-04 Internal Chat | `/api/chats` | Mhammad siag |
| UC-05 Admin Approval | `/api/admin` | Abdullah |

## Environment variables

See [`.env.example`](./.env.example) for the canonical list.

## Firebase emulator (local dev without hitting prod)

```bash
# from the repo root, not from backend/
firebase emulators:start
```

In another terminal, set the emulator host env vars before `npm run dev`:

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8080
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
export FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
npm run dev
```

The Admin SDK auto-detects these env vars and routes all traffic to the emulator instead of production Firebase.
